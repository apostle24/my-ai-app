import express from "express";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import fs from "fs";
import path from "path";
import Stripe from "stripe";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Set up VAPID keys for web push
  const vapidPath = path.join(process.cwd(), '.vapid.json');
  let vapidKeys;

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };
  } else if (fs.existsSync(vapidPath)) {
    vapidKeys = JSON.parse(fs.readFileSync(vapidPath, 'utf-8'));
  } else {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(vapidPath, JSON.stringify(vapidKeys));
    console.warn("Generated new VAPID keys. For production, set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.");
  }

  webpush.setVapidDetails(
    'mailto:contact@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

  app.get("/api/vapid-public-key", (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post("/api/send-notification", async (req, res) => {
    try {
      const { subscription, payload } = req.body;
      if (!subscription || !payload) {
        return res.status(400).json({ error: "Missing subscription or payload" });
      }
      
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      res.status(200).json({ success: true });
    } catch (error: any) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        console.log('Push subscription has expired or is no longer valid:', error.endpoint);
        return res.status(error.statusCode).json({ error: 'Subscription expired', statusCode: error.statusCode });
      }
      console.error("Error sending push notification:", error.message || error);
      res.status(500).json({ error: error.message, statusCode: error.statusCode });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const key = process.env.STRIPE_SECRET_KEY;
      const { product, origin, email, isUpgrade, interval } = req.body;

      if (!key || key === 'your_stripe_secret_key_here') {
        console.error("STRIPE_SECRET_KEY is missing. Cannot process real payments.");
        return res.status(500).json({ error: 'Stripe Secret Key is not configured. Please add STRIPE_SECRET_KEY to your environment variables to enable real payments.' });
      }

      const stripe = new Stripe(key);
      const successUrl = isUpgrade 
        ? `${origin}/#/ai-studio?upgrade_success=true`
        : `${origin}/#/marketplace?success=true&productId=${product?.id}`;
      const cancelUrl = isUpgrade
        ? `${origin}/#/ai-studio?canceled=true`
        : `${origin}/#/marketplace?canceled=true`;

      let sessionParams: any = {
        payment_method_types: ['card'],
        customer_email: email || undefined,
        success_url: successUrl,
        cancel_url: cancelUrl,
      };

      if (isUpgrade) {
        // Subscription mode
        const amount = interval === 'year' ? 9900 : 999; // $99.00/year or $9.99/month
        sessionParams.mode = 'subscription';
        sessionParams.line_items = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Pro Upgrade (${interval === 'year' ? 'Yearly' : 'Monthly'})`,
              },
              unit_amount: amount,
              recurring: {
                interval: interval === 'year' ? 'year' : 'month',
              },
            },
            quantity: 1,
          },
        ];
      } else {
        // One-time payment mode for marketplace products
        const amount = Math.round(product.price * 100 * 1.08); // Include 8% tax/fee
        sessionParams.mode = 'payment';
        sessionParams.line_items = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: product?.title || 'Digital Product',
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ];
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
