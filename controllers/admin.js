const {
	validationResult
} = require('express-validator');

const fileHelper = require('../util/file');

const Product = require('../models/product');

exports.getAddProduct = (req, res, next) => {
	res.render('admin/edit-product', {
		pageTitle: 'Add Product',
		path: '/admin/add-product',
		editing: false,
		hasError: false,
		errorMessage: null,
		validationError: []
	});
};

exports.postAddProduct = (req, res, next) => {
	const title = req.body.title;
	const image = req.file;
	const price = req.body.price;
	const description = req.body.description;


	if (!image) {
		return res.status(422).render('admin/edit-product', {
			pageTitle: 'Add Product',
			path: '/admin/add-product',
			editing: false,
			product: {
				title: title,
				price: price,
				description: description
			},
			isAuthenticated: req.session.isLoggedIn,
			hasError: true,
			errorMessage: 'Attached file is not an IMAGE',
			validationError: []
		});
	}

	const error = validationResult(req);

	if (!error.isEmpty()) {
		console.log('not passed isEmpty()')
		return res.status(422).render('admin/edit-product', {
			pageTitle: 'Add Product',
			path: '/admin/add-product',
			product: {
				title: title,
				imageUrl: image,
				price: price,
				description: description
			},
			editing: false,
			hasError: true,
			errorMessage: error.array()[0].msg,
			validationError: error.array()
		});
	} else {

		const imageUrl = image.path;

		const product = new Product({
			title: title,
			price: price,
			description: description,
			imageUrl: imageUrl,
			userId: req.user._id
		});

		return product.save()
			.then(result => {
				console.log('CREATED PRODUCT');
				res.redirect('/admin/products');
			})
			.catch(err => {
				console.log('Error creating new PRODUCT.');
				const error = new Error(err);
				error.httpStatusCode = 500;
				error.isAuthenticated = req.session.isLoggedIn;
				return next(error);
			});
	}
};

exports.getEditProduct = (req, res, next) => {
	const editMode = req.query.edit;
	console.log('Edit ' + editMode);
	if (!editMode) {
		return res.redirect('/');
	}
	const prodId = req.params.productId;
	Product.findById(prodId)
		.then(product => {
			if (!product) {
				return res.redirect('/');
			}
			if (product.userId.toString() !== req.user._id.toString()) {
				return res.redirect('/admin/products');
			}
			res.render('admin/edit-product', {
				pageTitle: 'Edit Product',
				path: '/admin/edit-product',
				editing: editMode,
				product: product,
				hasError: false,
				errorMessage: null,
				validationError: []
			});
		})
		.catch(err => {
			// res.redirect('/admin/products');
			console.log('Error! No Product with Product ID found');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};

exports.postEditProduct = (req, res, next) => {
	const prodId = req.body.productId;
	const updatedTitle = req.body.title;
	const updatedPrice = req.body.price;
	const updatedimage = req.file;
	const updatedDesc = req.body.description;

	const error = validationResult(req);
	if (!error.isEmpty()) {
		return res.status(422).render('admin/edit-product', {
			pageTitle: 'Edit Product',
			path: '/admin/edit-product',
			editing: true,
			product: {
				_id: prodId,
				title: updatedTitle,
				price: updatedPrice,
				description: updatedDesc
			},
			isAuthenticated: req.session.isLoggedIn,
			hasError: true,
			errorMessage: error.array()[0].msg,
			validationError: error.array()
		});
	}

	Product.findById(prodId)
		.then(product => {
			if (product.userId.toString() !== req.user._id.toString()) {
				return res.redirect('/admin/products');
			}
			product.title = updatedTitle;
			product.price = updatedPrice;
			product.description = updatedDesc;
			if (updatedimage) {

				fileHelper.deleteFile(product.imageUrl);

				product.imageUrl = updatedimage.path;

			}
			return product.save()
				.then(result => {
					console.log('UPDATED PRODUCT!');
					res.redirect('/admin/products');
				});
		})
		.catch(err => {
			console.log('Error occured while updating PRODUCT.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};


exports.getProducts = (req, res, next) => {
	Product.find({
			userId: req.user._id
		})
		.populate('userId')
		.then(products => {
			res.render('admin/products', {
				prods: products,
				pageTitle: 'Admin Products',
				path: '/admin/products',
				isAuthenticated: req.session.isLoggedIn
			});
		})
		.catch(err => {
			console.log('Error fetching PRODUCT(s) from DataBase.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
		});
};


exports.deleteProduct = (req, res, next) => {
	const prodId = req.params.productId;
	Product.findById(prodId)
		.then(product => {
			if (!product) {
				return next(new Error('Product not found'));
			}

			fileHelper.deleteFile(product.imageUrl);

			return Product.deleteOne({
				_id: prodId,
				userId: req.user._id
			})
		})
		.then(product => {
			if (!product) {
				return next(new Error('Product not found'));
			}
			console.log('DELETED PRODUCT');
			res.status(200).json({
				message: 'Success'
			});
		})
		.catch(err => {
			console.log('Error Deleting PRODUCT from DataBase.');
			res.status(500).json({
				message: 'DataBase Deletion Operation Failed'
			});
		});

}