const amount = document.getElementById('amount');
const name = document.getElementById('name');
const email = document.getElementById('email');
const contact = document.getElementById('contact');
const currency = document.getElementById('currency');
const paymentForm = document.getElementById('paymentForm');
const createOrderBtn = document.getElementById('create-order-btn');
const orderStatus = document.getElementById('order-status');

createOrderBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    if (!paymentForm.reportValidity()) return;

    orderStatus.textContent = 'Creating payment link...';

    const orderData = {
        amount: Number(amount.value),
        currency: currency.value,
        email: email.value,
        contact: contact.value,
        name: name.value
    };

    try {
        const response = await fetch('/create-payment-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });
        const result = await response.json();
        if (result.success) {
            if (!result.short_url) {
                throw new Error('Payment link was not returned by the server');
            }

            orderStatus.textContent = 'Redirecting to Razorpay...';
            console.log('Payment link response:', result);
            window.location.href = result.short_url;
        } else {
            throw new Error(result.error || 'Could not create payment link');
        }
    } catch (error) {
        orderStatus.textContent = `Error creating payment link: ${error.message}`;
        console.error('Error creating payment link:', error);
    }
});




document.getElementById('order').addEventListener('click', async (event) => {
    event.preventDefault();
    if (!paymentForm.reportValidity()) return;

    orderStatus.textContent = 'Creating order...';

    try {
        const response = await fetch('/create-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: Number(amount.value),
                currency: currency.value,
                name: name.value,
                email: email.value,
                contact: contact.value
            })
        });
        const order = await response.json();

        if (!response.ok || !order.success || !order.id) {
            throw new Error(order.error || 'Could not create order');
        }

        const checkout = new Razorpay({
            key: order.key_id,
            amount: order.amount,
            currency: order.currency,
            name: order.name,
            email: order.email,
            contact: order.contact,
            order_id: order.id,
            handler: (payment) => {
                orderStatus.textContent = `Payment successful. Payment ID: ${payment.razorpay_payment_id}`;
            }
        });

        checkout.on('payment.failed', (payment) => {
            orderStatus.textContent = `Payment failed: ${payment.error.description}`;
        });
        orderStatus.textContent = 'Opening Razorpay Checkout...';
        checkout.open();
    } catch (error) {
        orderStatus.textContent = `Error creating order: ${error.message}`;
        console.error('Error creating order:', error);
    }
});