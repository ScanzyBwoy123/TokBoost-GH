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
    //
    // IMPORTANT:
    // The customer cannot choose the price.
    // The server chooses it from this list.
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
    // NEVER put this key inside index.html.
    // It must remain in Netlify environment variables.
    // --------------------------------------------------------

    const secretKey =
      process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      console.error(
        "PAYSTACK_SECRET_KEY is missing."
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
    // GH₵40 = 4000 pesewas
    // --------------------------------------------------------

    const amountInPesewas =
      Math.round(amountGHS * 100);

    // --------------------------------------------------------
    // 8. Generate a unique reference
    // --------------------------------------------------------

    const reference =
      `TOKBOOST-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

    // --------------------------------------------------------
    // 9. Optional callback URL
    //
    // If SITE_URL exists in Netlify, Paystack can redirect
    // the customer back to the website after payment.
    // --------------------------------------------------------

    const siteUrl =
      process.env.SITE_URL;

    const paymentData = {
      email: email,
      amount: amountInPesewas,
      currency: "GHS",
      reference: reference,

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

    // Add callback only when SITE_URL is configured.
    if (siteUrl) {
      paymentData.callback_url =
        `${siteUrl.replace(/\/$/, "")}/payment-success.html`;
    }

    // --------------------------------------------------------
    // 10. Initialize Paystack transaction
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

        body: JSON.stringify(paymentData)
      }
    );

    const data =
      await response.json();

    // --------------------------------------------------------
    // 11. Handle Paystack errors
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
    // 12. Return only safe information to the browser
    // --------------------------------------------------------

    return {
      statusCode: 200,

      headers: {
        "Content-Type":
          "application/json"
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
          "GHS"
      })
    };

  } catch (error) {

    // --------------------------------------------------------
    // 13. Unexpected error
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
