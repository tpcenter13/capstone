import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../firebase";

// Define the request body interface
interface PaymentRequest {
  items: Array<{
    bookingId: string;
    venueId: string; // Equivalent to product_id
    quantity: number;
    venueName: string; // Equivalent to product_name
    price: number; // Price per unit
  }>;
  userEmail: string;
  userName: string;
  phone?: string; // Optional phone number for billing
}

// POST: Create a PayMongo checkout session for Debit Card
export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body: PaymentRequest = await req.json();
    const { items, userEmail, userName, phone } = body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0 || !userEmail || !userName) {
      return NextResponse.json(
        { error: "Missing required fields: items, userEmail, or userName" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (
        !item.bookingId ||
        !item.venueId ||
        !item.quantity ||
        !item.venueName ||
        !item.price
      ) {
        return NextResponse.json(
          { error: `Invalid item: ${JSON.stringify(item)}` },
          { status: 400 }
        );
      }
      if (item.quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for booking ${item.bookingId}` },
          { status: 400 }
        );
      }
    }

    // Calculate total amount and prepare line items
    let totalAmount = 0;
    const lineItems = items.map((item) => {
      const subtotal = item.price * item.quantity;
      totalAmount += subtotal;
      return {
        name: item.venueName,
        amount: Math.round(subtotal * 100), // total per line item in centavos
        quantity: item.quantity,
        currency: "PHP",
        description: `${item.quantity}x ${item.venueName}`,
      };
    });

    // Prepare checkout session data
    const checkoutData = {
      data: {
        attributes: {
          line_items: lineItems,
          payment_method_types: ["card"], // Restrict to card (includes debit cards)
          success_url: `${req.nextUrl.origin}/user`,
          cancel_url: `${req.nextUrl.origin}/cancel`,
          description: `Booking payment for ${userName}`,
          metadata: {
            userEmail,
            userName,
            items: items.map((item) => ({
              bookingId: item.bookingId,
              venueId: item.venueId,
              quantity: item.quantity,
              total_amount: (item.price * item.quantity).toFixed(2),
            })),
            total_amount: totalAmount.toFixed(2),
          },
          billing: {
            name: userName,
            email: userEmail,
            phone: phone || null,
          },
        },
      },
    };

    // Create PayMongo checkout session
    const response = await axios.post(
      "https://api.paymongo.com/v1/checkout_sessions",
      checkoutData,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(
            `${process.env.PAYMONGO_SECRET_KEY}:`
          ).toString("base64")}`,
        },
      }
    );

    const responseData = response.data;
    if (!responseData?.data?.attributes?.checkout_url) {
      console.error("PayMongo error", responseData);
      return NextResponse.json(
        {
          error: "Failed to create payment session",
          paymongo_response: responseData,
        },
        { status: 400 }
      );
    }

    const checkoutSessionId = responseData.data.id;
    const checkoutUrl = responseData.data.attributes.checkout_url;

    // Save booking data to Firebase
    for (const item of items) {
      const bookingRef = doc(db, "bookings", item.bookingId);
      await setDoc(
        bookingRef,
        {
          userEmail,
          userName,
          venueId: item.venueId,
          venueName: item.venueName,
          quantity: item.quantity,
          total_amount: (item.price * item.quantity).toFixed(2),
          status: "pending",
          paymentMethod: "card", // Updated to reflect debit card payment
          paymentDate: serverTimestamp(),
          paymongoCheckoutSessionId: checkoutSessionId,
        },
        { merge: true }
      );
    }

    // Return successful response
    return NextResponse.json(
      {
        isSuccess: true,
        message: "Payment session created successfully",
        checkout_url: checkoutUrl,
        total_amount: totalAmount.toFixed(2),
        full_name: userName,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("PayMongo payment error:", error);
    if (error.response) {
      return NextResponse.json(
        {
          error: "PayMongo error",
          details: error.response.data,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Handle CORS for preflight requests
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}