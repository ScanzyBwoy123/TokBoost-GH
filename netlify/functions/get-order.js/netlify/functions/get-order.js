// ============================================================
// TOKBOOST GH
// NETLIFY FUNCTION — GET ORDER FROM SUPABASE
// ============================================================
exports.handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== "GET") {
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
    // Get payment reference from URL
    const params = new URLSearchParams(
      event.rawQuery || ""
    );
    const reference = params.get("reference");
    if (!reference) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Payment reference is required."
        })
      };
    }
    // Supabase configuration
    const supabaseUrl =
      process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      console.error(
        "Missing Supabase environment variables."
      );
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Order database is not configured."
        })
      };
    }
    // Query the TokBoost orders table
    const url =
      `${supabaseUrl}/rest/v1/tokboost_orders` +
      `?reference=eq.${encodeURIComponent(reference)}` +
      `&select=*` +
      `&limit=1`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
      }
    });
    const orders = await response.json();
    if (!response.ok) {
      console.error(
        "Supabase error:",
        orders
      );
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Unable to retrieve your order."
        })
      };
    }
    // Order does not exist
    if (
      !Array.isArray(orders) ||
      orders.length === 0
    ) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Order not found."
        })
      };
    }
    const order = orders[0];
    // Return order information
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: true,
        order: order
      })
    };
  } catch (error) {
    console.error(
      "Get order error:",
      error
    );
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: false,
        error: "Something went wrong while retrieving your order."
      })
    };
  }
};
