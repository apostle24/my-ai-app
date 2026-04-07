import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe error:", error);
    res.status(500).json({ error: error.message });
  }
}
