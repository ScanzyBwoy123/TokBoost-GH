// ============================================================
// TOKBOOST GH
// NETLIFY FUNCTION — CREATE PAYSTACK PAYMENT
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

    const {
      email,
      packageName,
      tiktokTarget,
      customerName
    } = body;

    // --------------------------------------------------------
    // 3. Validate required information
    // --------------------------------------------------------

    if (
      !email ||
      !packageName ||
      !tiktokTarget ||
      !customerName
    ) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Please provide all required information."
        })
      };
    }

    // --------------------------------------------------------
    // 4. Validate email
    // --------------------------------------------------------

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Please provide a valid email address."
        })
      };
    }

    // --------------------------------------------------------
    // 5. SERVER-SIDE PACKAGE PRICES
    // --------------------------------------------------------

    const packages = {
      "Starter Promotion": 10,
      "1,000 Reach Campaign": 40,
      "5,000 Reach Campaign": 150,
      "Creator Growth": 250,
      "Premium Growth": 500
    };

    const amountGHS = packages[packageName];

    if (!amountGHS) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Invalid package selected."
        })
      };
    }

    // --------------------------------------------------------
    // 6. Get Paystack secret key
    //
    // IMPORTANT:
    // Keep this key in Netlify environment variables.
    // NEVER put the secret key in index.html.
    // --------------------------------------------------------

    const secretKey =
      process.env.PAYSTACK_API_KEY;

    if (!secretKey) {
      console.error(
        "PAYSTACK_API_KEY is missing."
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
    // 7. Convert Ghana cedis to pesewas
    //
    // GH₵10 = 1000 pesewas
    // GH₵40 = 4000 pesewas
    // --------------------------------------------------------

    const amountInPesewas =
      Math.round(amountGHS * 100);

    // --------------------------------------------------------
    // 8. Generate unique transaction reference
    // --------------------------------------------------------

    const reference =
      `TOKBOOST-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

    // --------------------------------------------------------
    // 9. Build callback URL
    //
    // This is where Paystack should return the customer
    // after payment.
    // --------------------------------------------------------

    const siteUrl =
      process.env.SITE_URL ||
      "https://tokboost-gh.netlify.app";

    const callbackUrl =
      `${siteUrl.replace(/\/$/, "")}/payment-success.html`;

    // --------------------------------------------------------
    // 10. Build Paystack transaction
    // --------------------------------------------------------

    const paymentData = {
      email: email,

      amount: amountInPesewas,

      currency: "GHS",

      reference: reference,

      callback_url: callbackUrl,

      metadata: {
        customerName: customerName,

        packageName: packageName,

        amountGHS: amountGHS,

        tiktokTarget: tiktokTarget,

        serviceType:
          "TikTok promotion campaign",

        description:
          "Legitimate TikTok content promotion. " +
          "Likes, followers, comments and shares are not guaranteed."
      }
    };

    // --------------------------------------------------------
    // 11. Initialize Paystack transaction
    // --------------------------------------------------------

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${secretKey}`,

          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(paymentData)
      }
    );

    const data =
      await response.json();

    // --------------------------------------------------------
    // 12. Handle Paystack errors
    // --------------------------------------------------------

    if (!response.ok || !data.status) {

      console.error(
        "Paystack initialization failed:",
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
            data.message ||
            "Unable to initialize payment."
        })
      };
    }

    // --------------------------------------------------------
    // 13. Make sure Paystack returned a checkout URL
    // --------------------------------------------------------

    if (
      !data.data ||
      !data.data.authorization_url
    ) {
      console.error(
        "Paystack did not return authorization_url:",
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
            "Paystack did not return a checkout URL."
        })
      };
    }

    // --------------------------------------------------------
    // 14. Return safe information to the browser
    // --------------------------------------------------------

    return {
      statusCode: 200,

      headers: {
        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-store"
      },

      body: JSON.stringify({
        status: true,

        message:
          "Payment initialized successfully.",

        authorization_url:
          data.data.authorization_url,

        access_code:
          data.data.access_code,

        reference:
          data.data.reference,

        packageName:
          packageName,

        amount:
          amountGHS,

        currency:
          "GHS",

        callback_url:
          callbackUrl
      })
    };

  } catch (error) {

    // --------------------------------------------------------
    // 15. Unexpected error
    // --------------------------------------------------------

    console.error(
      "Create payment error:",
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
          "Something went wrong while creating the payment."
      })
    };
  }
};
