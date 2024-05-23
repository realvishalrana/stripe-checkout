import { serve } from "@hono/node-server";
import { Hono } from "hono";
import "dotenv/config";
import Stripe from "stripe";
import { HTTPException } from "hono/http-exception";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

const app = new Hono();

app.get("/", (c) => {
  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Checkout</title>
      <script src="https://js.stripe.com/v3/"></script>
    </head>
    <body>
      <h1>Checkout</h1>
      <button id="checkoutButton">Checkout</button>

      <script>
        const checkoutButton = document.getElementById('checkoutButton');
        checkoutButton.addEventListener('click', async () => {
          const response = await fetch('/checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          const { id } = await response.json();
          const stripe = Stripe('${process.env.STRIPE_PUBLISHABLE_KEY}');
          await stripe.redirectToCheckout({ sessionId: id });
        });
      </script>
    </body>
  </html>
`;
  return c.html(html);
});

app.post("/", (c) => {
  return c.text("My Post Request");
});

app.post("/checkout", async (c) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRODUCT_ID,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000//cancel",
    });
    return c.json(session);
  } catch (error: any) {
    console.log("error: ", error);
    throw new HTTPException(500, { message: error?.message });
  }
});

app.get("/success", (c) => {
  return c.text("Payment Success!");
});

app.get("/cancel", (c) => {
  return c.text("Payment Cancel!");
});

app.post('/webhook', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature!, process.env.STRIPE_WEBHOOK_SECRET!); // for verfiy stripe signature 
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    throw new HTTPException(400)
  } 

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(session)

    // TODO Fulfill the purchase with your own business logic, for example:
    // Update Database with order details
    // Add credits to customer account
    // Send confirmation email
    // Print shipping label
    // Trigger order fulfillment workflow
    // Update inventory
    // Etc.
  }

  return c.text('success');
})


const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
