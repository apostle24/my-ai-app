import express from "express";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import fs from "fs";
import path from "path";

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
      console.error("Error sending push notification:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const key = process.env.PAYSTACK_SECRET_KEY;
      const { product, origin, email, isUpgrade } = req.body;

      // If no valid Paystack key is provided, simulate a successful checkout for testing purposes
      if (!key || key === 'your_paystack_secret_key_here' || key.includes('sk_test_')) {
        console.warn("PAYSTACK_SECRET_KEY is missing or invalid. Using mock checkout session for testing.");
        const redirectUrl = isUpgrade 
          ? `${origin}/#/ai-studio?upgrade_success=true` 
          : `${origin}/#/marketplace?success=true&productId=${product?.id}`;
        return res.json({ url: redirectUrl });
      }

      const amount = isUpgrade ? 4900 : Math.round(product.price * 100 * 1.08); // 49.00 GHS for upgrade
      const callbackUrl = isUpgrade 
        ? `${origin}/#/ai-studio?upgrade_success=true`
        : `${origin}/#/marketplace?success=true&productId=${product?.id}`;
      const cancelUrl = isUpgrade
        ? `${origin}/#/ai-studio?canceled=true`
        : `${origin}/#/marketplace?canceled=true`;

      // Create a Paystack Checkout Session
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email || 'customer@example.com',
          amount: amount,
          currency: 'GHS', // Explicitly set to GHS (Ghana Cedis)
          channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'], // Enable cards and multiple systems
          callback_url: callbackUrl,
          metadata: {
            cancel_action: cancelUrl,
            product_name: isUpgrade ? 'Pro Upgrade' : product?.title
          }
        })
      });

      const data = await response.json();

      if (data.status && data.data && data.data.authorization_url) {
        res.json({ url: data.data.authorization_url });
      } else {
        throw new Error(data.message || 'Failed to create Paystack session');
      }
    } catch (error: any) {
      console.error("Paystack error:", error);
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
