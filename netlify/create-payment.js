// TokBoost GH
// Netlify Function — Create Paystack Payment

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Method not allowed"
      })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const {
      email,
      amount,
      packageName,
      tiktokTarget
    } = body;

    // Basic validation
    if (!email || !amount || !packageName || !tiktokTarget) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Missing required order information."
        })
      };
    }

    // Make sure amount is a valid positive number
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Invalid payment amount."
        })
      };
    }

    // Paystack secret key MUST be stored in Netlify environment variables.
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      console.error("PAYSTACK_SECRET_KEY is not configured.");

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Payment service is not configured."
        })
      };
    }

    /*
      Paystack expects the amount in the smallest currency unit.

      Example:
      GH₵40 = 4000 pesewas
    */

    const amountInPesewas = Math.round(numericAmount * 100);

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
          amount: amountInPesewas,
          currency: "GHS",

          metadata: {
            packageName: packageName,
            tiktokTarget: tiktokTarget
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.status) {
      console.error("Paystack initialization failed:", data);

      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Unable to initialize payment."
        })
      };
    }

    // Return only information the browser needs.
    return {
      statusCode: 200,

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        status: true,
        authorization_url: data.data.authorization_url,
        access_code: data.data.access_code,
        reference: data.data.reference
      })
    };

  } catch (error) {

    console.error("Create payment error:", error);

    return {
      statusCode: 500,

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        error: "Something went wrong while creating the payment."
      })
    };
  }
};
