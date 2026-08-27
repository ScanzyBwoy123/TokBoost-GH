// ============================================================
// TOKBOOST GH
// SECURE ADMIN ORDER MANAGEMENT FUNCTION
// ============================================================

const crypto = require("crypto");


// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 4; // 4 hours


// ------------------------------------------------------------
// JSON response helper
// ------------------------------------------------------------

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
}


// ------------------------------------------------------------
// Constant-time string comparison
// ------------------------------------------------------------

function safeEqual(a, b) {

  const first =
    Buffer.from(String(a || ""));

  const second =
    Buffer.from(String(b || ""));

  if (
    first.length !==
    second.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    first,
    second
  );
}


// ------------------------------------------------------------
// Create signed admin token
//
// Format:
// timestamp.signature
// ------------------------------------------------------------

function createToken(secret) {

  const timestamp =
    Math.floor(
      Date.now() / 1000
    ).toString();

  const signature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(
        `tokboost-admin:${timestamp}`
      )
      .digest("hex");

  return `${timestamp}.${signature}`;
}


// ------------------------------------------------------------
// Verify signed admin token
// ------------------------------------------------------------

function verifyToken(
  token,
  secret
) {

  if (!token) {
    return false;
  }

  const parts =
    String(token).split(".");

  if (parts.length !== 2) {
    return false;
  }

  const timestamp =
    Number(parts[0]);

  const signature =
    parts[1];

  if (
    !Number.isFinite(timestamp)
  ) {
    return false;
  }

  const now =
    Math.floor(
      Date.now() / 1000
    );

  if (
    timestamp <= 0 ||
    now - timestamp < 0 ||
    now - timestamp >
      TOKEN_LIFETIME_SECONDS
  ) {
    return false;
  }

  const expected =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(
        `tokboost-admin:${timestamp}`
      )
      .digest("hex");

  return safeEqual(
    signature,
    expected
  );
}


// ------------------------------------------------------------
// Get Bearer token
// ------------------------------------------------------------

function getBearerToken(event) {

  const authorization =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";

  if (
    !authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return "";
  }

  return authorization
    .slice(7)
    .trim();
}


// ------------------------------------------------------------
// Supabase request helper
// ------------------------------------------------------------

async function supabaseRequest(
  url,
  key,
  options = {}
) {

  return fetch(
    url,
    {
      ...options,

      headers: {
        apikey: key,

        Authorization:
          `Bearer ${key}`,

        "Content-Type":
          "application/json",

        ...(options.headers || {})
      }
    }
  );
}


// ------------------------------------------------------------
// Validate status
// ------------------------------------------------------------

const ALLOWED_STATUSES = [
  "processing",
  "promotion",
  "completed",
  "cancelled"
];


// ------------------------------------------------------------
// Main handler
// ------------------------------------------------------------

exports.handler = async event => {

  // ----------------------------------------------------------
  // Required environment variables
  // ----------------------------------------------------------

  const adminPassword =
    process.env.TOKBOOST_ADMIN_PASSWORD;

  const supabaseUrl =
    process.env.SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


  // ----------------------------------------------------------
  // Configuration check
  // ----------------------------------------------------------

  if (
    !adminPassword ||
    !supabaseUrl ||
    !supabaseKey
  ) {

    console.error(
      "Admin environment variables are missing."
    );

    return json(
      500,
      {
        status: false,
        error:
          "Admin system is not configured."
      }
    );
  }


  try {

    // --------------------------------------------------------
    // LOGIN
    // --------------------------------------------------------

    if (
      event.httpMethod ===
      "POST"
    ) {

      let body = {};

      try {

        body =
          JSON.parse(
            event.body || "{}"
          );

      } catch {

        return json(
          400,
          {
            status: false,
            error:
              "Invalid request."
          }
        );
      }


      if (
        body.action ===
        "login"
      ) {

        const password =
          String(
            body.password || ""
          );


        if (
          !password ||
          !safeEqual(
            password,
            adminPassword
          )
        ) {

          return json(
            401,
            {
              status: false,
              error:
                "Invalid administrator credentials."
            }
          );
        }


        const token =
          createToken(
            adminPassword
          );


        return json(
          200,
          {
            status: true,
            token: token,
            expiresIn:
              TOKEN_LIFETIME_SECONDS
          }
        );
      }


      // ------------------------------------------------------
      // UPDATE ORDER STATUS
      // ------------------------------------------------------

      if (
        body.action ===
        "update_status"
      ) {

        const token =
          getBearerToken(event);


        if (
          !verifyToken(
            token,
            adminPassword
          )
        ) {

          return json(
            401,
            {
              status: false,
              error:
                "Unauthorized."
            }
          );
        }


        const orderId =
          String(
            body.orderId || ""
          ).trim();

        const newStatus =
          String(
            body.status || ""
          ).trim().toLowerCase();


        if (!orderId) {

          return json(
            400,
            {
              status: false,
              error:
                "Order ID is required."
            }
          );
        }


        if (
          !ALLOWED_STATUSES.includes(
            newStatus
          )
        ) {

          return json(
            400,
            {
              status: false,
              error:
                "Invalid order status."
            }
          );
        }


        const updateUrl =
          `${supabaseUrl}/rest/v1/tokboost_orders` +
          `?id=eq.${encodeURIComponent(
            orderId
          )}`;


        const updateResponse =
          await supabaseRequest(
            updateUrl,
            supabaseKey,
            {
              method: "PATCH",

              headers: {
                Prefer:
                  "return=representation"
              },

              body:
                JSON.stringify({
                  status:
                    newStatus
                })
            }
          );


        const updated =
          await updateResponse.json();


        if (
          !updateResponse.ok ||
          !Array.isArray(updated) ||
          !updated.length
        ) {

          console.error(
            "Order status update failed:",
            updated
          );

          return json(
            500,
            {
              status: false,
              error:
                "Unable to update the order."
            }
          );
        }


        return json(
          200,
          {
            status: true,
            order:
              updated[0]
          }
        );
      }


      return json(
        400,
        {
          status: false,
          error:
            "Invalid admin action."
        }
      );
    }


    // --------------------------------------------------------
    // GET ORDERS
    // --------------------------------------------------------

    if (
      event.httpMethod ===
      "GET"
    ) {

      const token =
        getBearerToken(event);


      if (
        !verifyToken(
          token,
          adminPassword
        )
      ) {

        return json(
          401,
          {
            status: false,
            error:
              "Unauthorized."
          }
        );
      }


      const ordersUrl =
        `${supabaseUrl}/rest/v1/tokboost_orders` +
        `?select=*` +
        `&order=created_at.desc`;


      const ordersResponse =
        await supabaseRequest(
          ordersUrl,
          supabaseKey,
          {
            method: "GET"
          }
        );


      const orders =
        await ordersResponse.json();


      if (
        !ordersResponse.ok ||
        !Array.isArray(orders)
      ) {

        console.error(
          "Could not retrieve orders:",
          orders
        );

        return json(
          500,
          {
            status: false,
            error:
              "Unable to retrieve orders."
          }
        );
      }


      return json(
        200,
        {
          status: true,
          orders: orders
        }
      );
    }


    // --------------------------------------------------------
    // METHOD NOT ALLOWED
    // --------------------------------------------------------

    return json(
      405,
      {
        status: false,
        error:
          "Method not allowed."
      }
    );

  } catch (error) {

    console.error(
      "Admin orders error:",
      error
    );

    return json(
      500,
      {
        status: false,
        error:
          "Something went wrong."
      }
    );
  }
};
