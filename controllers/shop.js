const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const stripe = require('stripe')('sk_test_ADR98TsnpXto3PyYh0Ip8oim00EliWYaT3');

const Product = require('../models/product');
const Order = require('../models/order');

const ITEMS_PER_PAGE = 1;

exports.getProducts = (req, res, next) => {
	let page = parseInt(req.query.page);
	let totalItems;
	if (!req.query.page) {
		page = 1;
	}

	Product
		.find()
		.countDocuments()
		.then(numProducts => {
			totalItems = numProducts;
			return Product.find()
				.skip((page - 1) * ITEMS_PER_PAGE)
				.limit(ITEMS_PER_PAGE)
		})
		.then(products => {
			res.render('shop/product-list', {
				prods: products,
				pageTitle: 'Products',
				path: '/products',
				currentPage: page,
				hasNextPage: ITEMS_PER_PAGE * page < totalItems,
				hasPreviousPage: page > 1,
				nextPage: page + 1,
				previousPage: page - 1,
				lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
			})
		})
		.catch(err => {
			console.log('Error! Home Page.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};


/*****************************************/


exports.getProduct = (req, res, next) => {
	const prodId = req.params.productId;
	Product.findById(prodId)
		.then(product => {
			res.render('shop/product-detail', {
				product: product,
				pageTitle: product.title,
				path: '/products'
			});
		})
		.catch(err => {
			console.log('Error! Cannot fetch single SHOP Product.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};


/*****************************************/


exports.getIndex = (req, res, next) => {
	let page = parseInt(req.query.page);
	let totalItems;
	if (!req.query.page) {
		page = 1;
	}

	Product
		.find()
		.countDocuments()
		.then(numProducts => {
			totalItems = numProducts;
			return Product.find()
				.skip((page - 1) * ITEMS_PER_PAGE)
				.limit(ITEMS_PER_PAGE)
		})
		.then(products => {
			res.render('shop/index', {
				prods: products,
				pageTitle: 'Shop',
				path: '/',
				currentPage: page,
				hasNextPage: ITEMS_PER_PAGE * page < totalItems,
				hasPreviousPage: page > 1,
				nextPage: page + 1,
				previousPage: page - 1,
				lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
			})
		})
		.catch(err => {
			console.log('Error! Home Page.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});

};


/*****************************************/


exports.getCart = (req, res, next) => {
	req.user
		.populate('cart.items.productId')
		.execPopulate()
		.then(user => {
			const products = user.cart.items;
			res.render('shop/cart', {
				path: '/cart',
				pageTitle: 'Your Cart',
				products: products
			});
		})
		.catch(err => {
			console.log('Error! Fetching User CART.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};


/*****************************************/


exports.postCart = (req, res, next) => {
	const prodId = req.body.productId;
	Product.findById(prodId)
		.then(product => {
			return req.user.addToCart(product);
		})
		.then(result => {
			console.log('Added to Cart');
			res.redirect('/cart');
		})
		.catch(err => {
			console.log('Error! Saving User CART.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};


/*****************************************/


exports.postCartDeleteProduct = (req, res, next) => {
	const prodId = req.body.productId;
	req.user
		.removeFromCart(prodId)
		.then(result => {
			console.log('CART ITEM DELETED');
			res.redirect('/cart');
		})
		.catch(err => {
			console.log('Error! Deleting CART Item.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};


/*****************************************/


exports.postOrder = (req, res, next) => {

	const token = req.body.stripeToken;
	let totalSum = 0;


	req.user
		.populate('cart.items.productId')
		.execPopulate()
		.then(user => {
			user.cart.items.forEach(p => {
				totalSum += p.quantity * p.productId.price;
			});
			
			return user.cart.items.map(item => {
				return {
					quantity: item.quantity,
					product: {
						...item.productId._doc
					}
				}
			});
		})
		.then(prods => {
			const order = new Order({
				user: {
					name: req.user.name,
					email: req.user.email,
					userId: req.user
				},
				products: prods
			});

			return order.save();
		})
		.then(result => {
			const charge = stripe.charges.create({
				amount: totalSum * 100,
				currency: 'usd',
				description: 'Demo Order',
				source: token,
				metadata: { order_id: result._id.toString() }
			});
			return req.user.clearCart();
		})
		.then(result => {
			console.log('Order Placed');
			res.redirect('/orders');
		})
		.catch(err => {
			console.log('Error! Order Item.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};


/*****************************************/


exports.getOrders = (req, res, next) => {
	Order.find({
			'user.userId': req.user._id
		})
		.then(orders => {
			res.render('shop/orders', {
				path: '/orders',
				pageTitle: 'Your Orders',
				orders: orders
			});
		})
		.catch(err => {
			console.log('Error! Getting ORDER of USER.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};


/*****************************************/


exports.getInvoice = (req, res, next) => {
	const orderId = req.params.orderId; // 5da48ce3ef8c7b1db09394fb

	Order.findById(orderId)
		.then(order => {
			if (!order) {
				return next(new Error('No order found'));
			}
			if (order.user.userId.toString() !== req.user._id.toString()) {
				return next(new Error('Unauthorized'));
			}

			const invoiceName = 'invoice-' + orderId + '.pdf';
			const invoicePath = path.join('data', 'invoices', invoiceName);

			const pdfDoc = new PDFDocument();

			pdfDoc.pipe(fs.createWriteStream(invoicePath));
			pdfDoc.pipe(res);

			pdfDoc.fontSize(28).text('Invoice', {
				align: 'center',
				underline: true
			});
			pdfDoc.text('------------------------\n\n', {
				align: 'center'
			});

			let totalPrice = 0;
			order.products.forEach(p => {
				totalPrice = totalPrice + p.product.price * p.quantity;
				pdfDoc.fontSize(18).text(p.product.title + ' - (' + p.quantity + ') x ' + '$' + p.product.price);
				pdfDoc.text('\n');
			});

			pdfDoc.fontSize(24).text('\nTotal Price : $' + totalPrice);

			pdfDoc.end();

			res.setHeader('Content-Type', 'application/pdf');
			res.setHeader(
				'Content-Disposition',
				'inline; filename="' + invoiceName + '"'
			);

		})
		.catch(err => {
			next(err);
		});

}


/*****************************************/


exports.getCheckout = (req, res, next) => {
	req.user
		.populate('cart.items.productId')
		.execPopulate()
		.then(user => {
			const products = user.cart.items;
			let total = 0;
			products.forEach(p => {
				total += p.quantity * p.productId.price;
			})
			return res.render('shop/checkout', {
				path: '/checkout',
				pageTitle: 'Checkout',
				products: products,
				totalSum: total
			});
		})
		.catch(err => {
			console.log('Error! Fetching User CART.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
}