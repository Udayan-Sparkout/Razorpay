import express from 'express';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

const app=express();
app.use(express.static('public'));






app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const razorpaySignature = req.headers['x-razorpay-signature'];
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(req.body)
            .digest('hex');

        if (razorpaySignature !== expectedSignature) {
            return res.status(400).json({ success: false, error: 'Invalid signature' });
        }

        const data = JSON.parse(req.body.toString());
        const supportedEvents = ['payment_link.paid', 'payment.captured','order.paid'];
        if (!supportedEvents.includes(data.event)) {
            return res.status(200).json({ success: true, received: true });
        }

        const paymentLink = data.payload?.payment_link?.entity;
        const payment = data.payload?.payment?.entity;
        const order = data.payload?.order?.entity;
        const amount = payment?.amount ?? paymentLink?.amount ?? order?.amount;
        const currency = payment?.currency ?? paymentLink?.currency ?? order?.currency;
        const customerEmail =
            payment?.email ||
            paymentLink?.customer_details?.email ||
            paymentLink?.customer?.email ||
            order?.notes?.customer_email ||
            order?.notes?.email;

        if (!customerEmail) {
            return res.status(400).json({
                success: false,
                error: 'Customer email not found'
            });
        }

        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: customerEmail,
            subject: 'Payment Confirmation',
            text: `Your payment of ${amount / 100} ${currency} has been successfully received. Payment ID: ${payment?.id}. Thank you for your payment!`
        });

        return res.status(200).json({ success: true, received: true });
    } catch (error) {
        console.error('Error processing Razorpay webhook:', error);
        return res.status(500).json({
            success: false,
            error: 'Could not process webhook'
        });
    }
});




app.use(express.json());


app.use((req, res, next) => {
  console.log("Incoming request:", req.method, req.url);
  next();
});

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


app.get("/", async (req, res) => {
    res.send("Server is working!");
});

app.get('/testemail',async(req,res)=>{
    try{
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER,
            subject: 'Test Email',
            text: 'This is a test email sent from the Node.js server.'
        };
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Email sent successfully!' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ success: false, error: 'Could not send email' });
    }
})

app.post('/create-payment-link', async (req, res) => {
    try {
        const { amount, currency, name, email, contact } = req.body;
        const paymentLink = await razorpay.paymentLink.create({
            amount: amount * 100, // Razorpay expects amount in paise
            currency,
            customer: { name, email, contact }
        });
        res.json({ success: true, ...paymentLink });
    } catch (error) {
        console.error('Error creating payment link:', error);
        const statusCode = Number(error?.statusCode);
        res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
            success: false,
            error: error?.error?.description || 'Could not create payment link'
        });
    }
});


app.post('/create-order', async (req, res) => {
    try {
        const { amount, currency, name, email, contact } = req.body;
        const razorpayOrder = await razorpay.orders.create({
            amount: amount * 100,
            currency,
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1,
            notes: {
                customer_name: name,
                customer_email: email,
                customer_contact: contact
            }
        });

        res.json({
            success: true,
            ...razorpayOrder,
            key_id: process.env.RAZORPAY_KEY_ID,
            name,
            email,
            contact
        });
    } catch (error) {
        console.error('Error creating order:', error);
        const statusCode = Number(error?.statusCode);
        res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
            success: false,
            error: error?.error?.description || 'Could not create order'
        });
    }
});












const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})
