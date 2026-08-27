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
    const body = JSON.parse(event.body || "{}");

    const {
      reference,
      packageName
    } = body;

    // --------------------------------------------------------
    // 1. Validate request
    // --------------------------------------------------------

    if (!reference || !packageName) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Payment reference and package are required."
        })
      };
    }

    // --------------------------------------------------------
    // 2. Server-side package prices
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
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Invalid package."
        })
      };
    }

    // --------------------------------------------------------
    // 3. Get Paystack secret key
    // --------------------------------------------------------

    const secretKey =
      process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      console.error(
        "PAYSTACK_SECRET_KEY is not configured."
      );

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Payment service is not configured."
        })
      };
    }

    // --------------------------------------------------------
    // 4. Ask Paystack to verify transaction
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

    if (!response.ok || !data.status) {
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
          error:
            "Unable to verify payment."
        })
      };
    }

    const transaction =
      data.data;

    // --------------------------------------------------------
    // 5. Check transaction status
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
    // 6. Check currency
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
    // 7. Check amount
    //
    // Paystack returns amount in pesewas.
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
    // 8. Payment successfully verified
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
        error:
          "Something went wrong while verifying payment."
      })
    };
  }
};
