// ============================================================
// TOKBOOST GH
// NETLIFY FUNCTION — UPDATE ORDER STATUS
// ============================================================

exports.handler = async (event) => {
  // ----------------------------------------------------------
  // 1. Only allow POST
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
    const newStatus = body.status;
    const adminKey = body.adminKey;

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

    if (!newStatus) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Order status is required."
        })
      };
    }

    // --------------------------------------------------------
    // 3. Check allowed statuses
    // --------------------------------------------------------

    const allowedStatuses = [
      "processing",
      "promotion_in_progress",
      "completed"
    ];

    if (!allowedStatuses.includes(newStatus)) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Invalid order status."
        })
      };
    }

    // --------------------------------------------------------
    // 4. Check admin key
    //
    // IMPORTANT:
    // Set ADMIN_UPDATE_KEY in Netlify environment variables.
    // Never put the real key directly in this file.
    // --------------------------------------------------------

    const serverAdminKey =
      process.env.ADMIN_UPDATE_KEY;

    if (!serverAdminKey) {
      console.error(
        "ADMIN_UPDATE_KEY is not configured."
      );

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Order management is not configured."
        })
      };
    }

    if (!adminKey || adminKey !== serverAdminKey) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: false,
          error: "Unauthorized."
        })
      };
    }

    // --------------------------------------------------------
    // 5. Get Supabase credentials
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
          error: "Order database is not configured."
        })
      };
    }

    // --------------------------------------------------------
    // 6. Find the order first
    // --------------------------------------------------------

    const findUrl =
      `${supabaseUrl}/rest/v1/tokboost_orders` +
      `?reference=eq.${encodeURIComponent(reference)}` +
      `&select=*` +
      `&limit=1`;

    const findResponse =
      await fetch(findUrl, {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization:
            `Bearer ${supabaseKey}`,
          "Content-Type":
            "application/json"
        }
      });

    const orders =
      await findResponse.json();

    if (!findResponse.ok) {
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
            "Unable to check the order."
        })
      };
    }

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
    // 7. Update the order
    // --------------------------------------------------------

    const updateUrl =
      `${supabaseUrl}/rest/v1/tokboost_orders` +
      `?reference=eq.${encodeURIComponent(reference)}`;

    const updateResponse =
      await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          apikey: supabaseKey,
          Authorization:
            `Bearer ${supabaseKey}`,
          "Content-Type":
            "application/json",
          Prefer:
            "return=representation"
        },
        body: JSON.stringify({
          status: newStatus
        })
      });

    const updatedOrders =
      await updateResponse.json();

    if (!updateResponse.ok) {
      console.error(
        "Supabase order update failed:",
        updatedOrders
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
            "Unable to update the order status."
        })
      };
    }

    const updatedOrder =
      Array.isArray(updatedOrders)
        ? updatedOrders[0]
        : updatedOrders;

    // --------------------------------------------------------
    // 8. Return success
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
          "Order status updated successfully.",
        order: updatedOrder
      })
    };

  } catch (error) {
    console.error(
      "Update order status error:",
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
          "Something went wrong while updating the order."
      })
    };
  }
};
