// ============================================================
// TOKBOOST GH
// NETLIFY FUNCTION — VERIFY PAYSTACK PAYMENT + CREATE ORDER
// ============================================================

exports.handler = async (event) => {
  // ----------------------------------------------------------
  // 1. Only allow POST requests
  // ----------------------------------------------------------

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: false,
        error: "Method not allowed"
      })
    };
  }

  try {
    // --------------------------------------------------------
    // 2. Read request body
    // --------------------------------------------------------

    const body = JSON.parse(event.body || "{}");

    const reference = body.reference;

    if (!reference) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error: "Payment reference is required."
        })
      };
    }

    // --------------------------------------------------------
    // 3. Get Paystack secret key
    // --------------------------------------------------------

    const secretKey =
      process.env.PAYSTACK_API_KEY;

    if (!secretKey) {
      console.error(
        "PAYSTACK_API_KEY is not configured."
      );

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error: "Payment service is not configured."
        })
      };
    }

    // --------------------------------------------------------
    // 4. Get Supabase credentials
    // --------------------------------------------------------

    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error(
        "Supabase environment variables are missing."
      );

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error: "Order database is not configured."
        })
      };
    }

    // --------------------------------------------------------
    // 5. Verify transaction with Paystack
    // --------------------------------------------------------

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${secretKey}`,

          "Content-Type":
            "application/json"
        }
      }
    );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.status ||
      !data.data
    ) {
      console.error(
        "Paystack verification failed:",
        data
      );

      return {
        statusCode: 400,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error:
            data.message ||
            "Unable to verify payment."
        })
      };
    }

    const transaction =
      data.data;

    // --------------------------------------------------------
    // 6. Check transaction status
    // --------------------------------------------------------

    if (transaction.status !== "success") {
      return {
        statusCode: 400,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error:
            "Payment has not been completed."
        })
      };
    }

    // --------------------------------------------------------
    // 7. Check currency
    // --------------------------------------------------------

    if (transaction.currency !== "GHS") {
      return {
        statusCode: 400,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error:
            "Payment currency does not match."
        })
      };
    }

    // --------------------------------------------------------
    // 8. Get information from Paystack metadata
    // --------------------------------------------------------

    const metadata =
      transaction.metadata || {};

    const packageName =
      metadata.packageName;

    const customerName =
      metadata.customerName ||
      "";

    const tiktokTarget =
      metadata.tiktokTarget ||
      "";

    // --------------------------------------------------------
    // 9. Make sure package exists
    // --------------------------------------------------------

    if (!packageName) {
      console.error(
        "Package name missing from Paystack metadata:",
        metadata
      );

      return {
        statusCode: 400,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error:
            "Package information was not found for this payment."
        })
      };
    }

    // --------------------------------------------------------
    // 10. Server-side package prices
    // --------------------------------------------------------

    const packages = {
      "Starter Promotion": 10,
      "1,000 Reach Campaign": 40,
      "5,000 Reach Campaign": 150,
      "Creator Growth": 250,
      "Premium Growth": 500
    };

    const expectedAmount =
      packages[packageName];

    if (!expectedAmount) {
      console.error(
        "Unknown package:",
        packageName
      );

      return {
        statusCode: 400,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error:
            "Invalid package associated with this payment."
        })
      };
    }

    // --------------------------------------------------------
    // 11. Check amount
    // --------------------------------------------------------

    const expectedAmountInPesewas =
      Math.round(expectedAmount * 100);

    if (
      Number(transaction.amount) !==
      expectedAmountInPesewas
    ) {
      console.error(
        "Amount mismatch:",
        {
          expected:
            expectedAmountInPesewas,

          received:
            transaction.amount
        }
      );

      return {
        statusCode: 400,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error:
            "Payment amount does not match the package."
        })
      };
    }

    // --------------------------------------------------------
    // 12. Get customer email
    // --------------------------------------------------------

    const customerEmail =
      transaction.customer &&
      transaction.customer.email
        ? transaction.customer.email
        : "";

    if (!customerEmail) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error:
            "Customer email was not found."
        })
      };
    }

    // --------------------------------------------------------
    // 13. Make sure TikTok target exists
    // --------------------------------------------------------

    if (!tiktokTarget) {
      console.error(
        "TikTok target missing from metadata:",
        metadata
      );

      return {
        statusCode: 400,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error:
            "TikTok target was not found for this payment."
        })
      };
    }

    // --------------------------------------------------------
    // 14. Check whether this order already exists
    //
    // This prevents duplicate orders if the customer refreshes
    // the payment-success page.
    // --------------------------------------------------------

    const existingOrderResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/tokboost_orders?reference=eq.${encodeURIComponent(
          transaction.reference
        )}&select=id,reference,customer_name,email,package_name,amount,tiktok_target,status,created_at&limit=1`,
        {
          method: "GET",

          headers: {
            apikey:
              supabaseKey,

            Authorization:
              `Bearer ${supabaseKey}`,

            "Content-Type":
              "application/json"
          }
        }
      );

    const existingOrders =
      await existingOrderResponse.json();

    if (
      !existingOrderResponse.ok
    ) {
      console.error(
        "Could not check existing order:",
        existingOrders
      );

      return {
        statusCode: 500,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: false,
          error:
            "Could not check the order database."
        })
      };
    }

    // --------------------------------------------------------
    // 15. If order already exists, return it
    // --------------------------------------------------------

    if (
      Array.isArray(existingOrders) &&
      existingOrders.length > 0
    ) {
      const existingOrder =
        existingOrders[0];

      return {
        statusCode: 200,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: true,
          paid: true,
          orderCreated: true,
          alreadyExists: true,

          orderId:
            existingOrder.id,

          reference:
            existingOrder.reference,

          packageName:
            existingOrder.package_name,

          amount:
            existingOrder.amount,

          currency:
            "GHS",

          customerEmail:
            existingOrder.email,

          customerName:
            existingOrder.customer_name,

          tiktokTarget:
            existingOrder.tiktok_target,

          orderStatus:
            existingOrder.status,

          message:
            "Payment verified and order already exists."
        })
      };
    }

    // --------------------------------------------------------
    // 16. Create the TokBoost order
    // --------------------------------------------------------

    const order = {
      reference:
        transaction.reference,

      customer_name:
        customerName,

      email:
        customerEmail,

      package_name:
        packageName,

      amount:
        expectedAmount,

      tiktok_target:
        tiktokTarget,

      status:
        "processing"
    };

    const createOrderResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/tokboost_orders`,
        {
          method: "POST",

          headers: {
            apikey:
              supabaseKey,

            Authorization:
              `Bearer ${supabaseKey}`,

            "Content-Type":
              "application/json",

            Prefer:
              "return=representation"
          },

          body:
            JSON.stringify(order)
        }
      );

    const createdOrders =
      await createOrderResponse.json();

    if (
      !createOrderResponse.ok
    ) {
      console.error(
        "Failed to create TokBoost order:",
        createdOrders
      );

      return {
        statusCode: 500,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          paid: true,
          orderCreated: false,
          error:
            "Payment was verified, but we could not create your order. Please contact support."
        })
      };
    }

    const createdOrder =
      Array.isArray(createdOrders)
        ? createdOrders[0]
        : createdOrders;

    // --------------------------------------------------------
    // 17. Return successful result
    // --------------------------------------------------------

    return {
      statusCode: 200,

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        status: true,
        paid: true,
        orderCreated: true,
        alreadyExists: false,

        orderId:
          createdOrder.id,

        reference:
          transaction.reference,

        packageName:
          packageName,

        amount:
          expectedAmount,

        currency:
          "GHS",

        customerEmail:
          customerEmail,

        customerName:
          customerName,

        tiktokTarget:
          tiktokTarget,

        orderStatus:
          "processing",

        message:
          "Payment verified and order created successfully."
      })
    };

  } catch (error) {

    // --------------------------------------------------------
    // 18. Unexpected error
    // --------------------------------------------------------

    console.error(
      "Verify payment error:",
      error
    );

    return {
      statusCode: 500,

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        status: false,
        paid: false,
        error:
          "Something went wrong while verifying payment."
      })
    };
  }
};
