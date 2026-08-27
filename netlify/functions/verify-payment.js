// ============================================================
// TOKBOOST GH
// NETLIFY FUNCTION — VERIFY PAYSTACK PAYMENT
// ============================================================

exports.handler = async (event) => {
  // Only allow POST requests
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
    // 1. Read request body
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
    // 2. Get Paystack secret key
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
    // 3. Verify transaction with Paystack
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

    if (!response.ok || !data.status || !data.data) {
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
    // 4. Check transaction status
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
    // 5. Check currency
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
    // 6. Get package from Paystack metadata
    // --------------------------------------------------------

    const metadata =
      transaction.metadata || {};

    const packageName =
      metadata.packageName;

    const amountGHS =
      Number(
        metadata.amountGHS ||
        Number(transaction.amount) / 100
      );

    // --------------------------------------------------------
    // 7. Make sure package information exists
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
    // 8. Server-side package prices
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
        "Unknown package from Paystack:",
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
    // 9. Check amount
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
    // 10. Payment successfully verified
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

        reference:
          transaction.reference,

        packageName:
          packageName,

        amount:
          expectedAmount,

        currency:
          "GHS",

        customerEmail:
          transaction.customer &&
          transaction.customer.email
            ? transaction.customer.email
            : null,

        message:
          "Payment verified successfully."
      })
    };

  } catch (error) {

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
