const path = require('path');

const express = require('express');

const {
    body
} = require('express-validator')

const adminController = require('../controllers/admin');

const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.get('/add-product', isAuth, adminController.getAddProduct);

router.get('/products', isAuth, adminController.getProducts);

router.post('/add-product', 
    isAuth, 
    [
        body('title', 'Title must be atleast 5 words long')
            .trim()
            .isString()
            .isLength({ min: 5 }),
        
        
        body('price')
        .isFloat()
        .withMessage('Price is Required')
        .custom(value => {
            if(value > 0) {
                return true;
            }
            return false;
        })
        .withMessage('Price must be a valid Number'),


        body('description', 'Description must be atleast 10 words long')
            .trim()
            .isLength({ min: 10, max: 400 })
    ],

    adminController.postAddProduct
);

router.get('/edit-product/:productId', isAuth, adminController.getEditProduct);

router.post('/edit-product', 
    isAuth, 
    [
        body('title', 'Title must be atleast 5 words long')
            .trim()
            .isString()
            .isLength({ min: 5 }),
            
        
        body('price')
        .isFloat()
        .withMessage('Price is Required')
        .custom(value => {
            if(value > 0) {
                return true;
            }
            return false;
        })
        .withMessage('Price must be a valid Number'),


        body('description', 'Description must be atleast 10 words long')
            .trim()
            .isLength({ min: 10, max: 400 })
    ],
    adminController.postEditProduct
);

router.delete('/product/:productId', isAuth, adminController.deleteProduct);

module.exports = router;