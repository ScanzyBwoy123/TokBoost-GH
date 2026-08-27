// ============================================================
// TOKBOOST GH
// NETLIFY FUNCTION — GET ORDER
// ============================================================
exports.handler = async (event) => {
  // ----------------------------------------------------------
  // 1. Only allow GET requests
  // ----------------------------------------------------------
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
    // --------------------------------------------------------
    // 2. Get payment reference from URL
    // --------------------------------------------------------
    const params =
      new URLSearchParams(
        event.rawQuery || ""
      );
    const reference =
      params.get("reference");
    if (!reference) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          error:
            "Payment reference is required."
        })
      };
    }
    // --------------------------------------------------------
    // 3. Get Supabase credentials
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
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          error:
            "Order database is not configured."
        })
      };
    }
    // --------------------------------------------------------
    // 4. Search for order
    // --------------------------------------------------------
    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/tokboost_orders?reference=eq.${encodeURIComponent(
          reference
        )}&select=id,created_at,reference,customer_name,email,package_name,amount,tiktok_target,status&limit=1`,
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
    const orders =
      await response.json();
    if (!response.ok) {
      console.error(
        "Supabase order lookup failed:",
        orders
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
            "Unable to retrieve your order."
        })
      };
    }
    // --------------------------------------------------------
    // 5. Order not found
    // --------------------------------------------------------
    if (
      !Array.isArray(orders) ||
      orders.length === 0
    ) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          status: false,
          error:
            "Order not found."
        })
      };
    }
    // --------------------------------------------------------
    // 6. Return order
    // --------------------------------------------------------
    const order =
      orders[0];
    return {
      statusCode: 200,
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        status: true,
        order: {
          id:
            order.id,
          createdAt:
            order.created_at,
          reference:
            order.reference,
          customerName:
            order.customer_name,
          email:
            order.email,
          packageName:
            order.package_name,
          amount:
            order.amount,
          currency:
            "GHS",
          tiktokTarget:
            order.tiktok_target,
          status:
            order.status
        }
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
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        status: false,
        error:
          "Something went wrong while retrieving the order."
      })
    };
  }
};
