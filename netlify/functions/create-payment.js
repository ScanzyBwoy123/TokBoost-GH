// ============================================================
// TOKBOOST GH
// NETLIFY FUNCTION — CREATE PAYSTACK PAYMENT
// ============================================================

exports.handler = async (event) => {
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

    const email = String(body.email || "").trim();
    const packageName = String(body.packageName || "").trim();
    const customerName = String(body.customerName || "").trim();
    const tiktokTarget = String(body.tiktokTarget || "").trim();

    if (!email) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Email is required."
        })
      };
    }

    if (!packageName) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Package is required."
        })
      };
    }

    if (!tiktokTarget) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "TikTok target is required."
        })
      };
    }

    // --------------------------------------------------------
    // Server-side package prices
    // --------------------------------------------------------

    const packages = {
      "Starter Promotion": 10,
      "1,000 Reach Campaign": 40,
      "5,000 Reach Campaign": 150,
      "Creator Growth": 250,
      "Premium Growth": 500
    };

    const amount = packages[packageName];

    if (!amount) {
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
    // Paystack secret key
    // --------------------------------------------------------

    const secretKey = process.env.PAYSTACK_API_KEY;

    if (!secretKey) {
      console.error("PAYSTACK_API_KEY is not configured.");

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
    // Generate unique TokBoost reference
    // --------------------------------------------------------

    const reference =
      `TOKBOOST-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

    // --------------------------------------------------------
    // Initialize Paystack transaction
    // --------------------------------------------------------

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          email: email,

          amount: Math.round(amount * 100),

          currency: "GHS",

          reference: reference,

          callback_url:
            `${process.env.URL || ""}/payment-success.html`,

          metadata: {
            packageName: packageName,
            customerName: customerName,
            tiktokTarget: tiktokTarget
          }
        })
      }
    );

    const data = await response.json();

    // --------------------------------------------------------
    // Check Paystack response
    // --------------------------------------------------------

    if (
      !response.ok ||
      !data.status ||
      !data.data
    ) {
      console.error(
        "Paystack initialization failed:",
        data
      );

      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error:
            data.message ||
            "Unable to initialize payment."
        })
      };
    }

    // --------------------------------------------------------
    // Return payment information
    // --------------------------------------------------------

    return {
      statusCode: 200,

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        status: true,
        reference: reference,
        authorization_url:
          data.data.authorization_url,
        access_code:
          data.data.access_code,
        amount: amount,
        currency: "GHS",
        packageName: packageName,
        message:
          "Payment initialized successfully."
      })
    };

  } catch (error) {
    console.error(
      "Create payment error:",
      error
    );

    return {
      statusCode: 500,

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        status: false,
        error:
          "Something went wrong while creating the payment."
      })
    };
  }
};
