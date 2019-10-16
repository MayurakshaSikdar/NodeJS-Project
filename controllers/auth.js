const bcrypt = require('bcryptjs')
const nodemailer = require('nodemailer');
const sendGridTransport = require('nodemailer-sendgrid-transport');
const crypto = require('crypto');
const {
    validationResult
} = require('express-validator')


const User = require('../models/user');

const emailTemplate = require('../Email Template/green');

const transport = nodemailer.createTransport(sendGridTransport({
    auth: {
        api_key: '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'
    }
}));

exports.getLogin = (req, res, next) => {
    let message = req.flash('error');
    if (message.length > 0) {
        message = message[0];
    } else {
        message = null;
    }
    res.render('auth/login', {
        path: '/login',
        pageTitle: 'Login',
        errorMessage: message,
        oldInput: {
            email: '',
            password: ''
        },
        validationError: []
    });
};


exports.postLogin = (req, res, next) => {
    const email = req.body.email;
    const password = req.body.password;

    const error = validationResult(req);

    if (!error.isEmpty()) {
        const err = error.array()[0];
        const errorMessage = err.msg;
        return res
            .render('auth/login', {
                path: '/login',
                pageTitle: 'Login',
                errorMessage: errorMessage,
                oldInput: {
                    email: req.body.email,
                    password: req.body.password
                },
                validationError: error.array()
            });
    }

    User.findOne({
            email: email
        })
        .then(user => {
            if (!user) {
                return res.status(422).render('auth/login', {
                    path: '/login',
                    pageTitle: 'Login',
                    errorMessage: 'Invalid Email/Password',
                    oldInput: {
                        email: req.body.email,
                        password: req.body.password
                    },
                    validationError: []
                });
            }
            return bcrypt.compare(password, user.password)
                .then(match => {
                    if (match) {
                        req.session.isLoggedIn = true;
                        req.session.user = user;
                        return req.session.save(err => {
                            if (err) {
                                console.log(err);
                            }
                            res.redirect('/');
                        });
                    }
                    return res.status(422).render('auth/login', {
                        path: '/login',
                        pageTitle: 'Login',
                        errorMessage: 'Invalid Email/Password',
                        oldInput: {
                            email: req.body.email,
                            password: req.body.password
                        },
                        validationError: []
                    });
                })
                .catch(err => {
                    console.log(err);
                });
        })
        .catch(err => {
            // res.redirect('/login');
            // console.log(err);
            console.log('Error! LOGIN.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
        });
};

exports.postLogout = (req, res, next) => {
    req.session.destroy(err => {
        if (err) {
            console.log(err);
        }
        res.redirect('/');
    })
}


exports.getSignUp = (req, res, next) => {
    let message = req.flash('error');
    if (message.length > 0) {
        message = message[0];
    } else {
        message = null;
    }

    res.render('auth/signup', {
        path: '/signup',
        pageTitle: 'SignUp',
        errorMessage: message,
        oldInput: {
            name: '',
            email: '',
            password: '',
            confirmPassword: ''
        },
        validationError: []
    });
}



exports.postSignUp = (req, res, next) => {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    const error = validationResult(req);

    if (!error.isEmpty()) {
        const err = error.array()[0];
        const errorMessage = err.msg;
        return res
            .status(422)
            .render('auth/signup', {
                path: '/signup',
                pageTitle: 'SignUp',
                errorMessage: errorMessage,
                oldInput: {
                    name: name,
                    email: email,
                    password: password,
                    confirmPassword: req.body.confirmPassword
                },
                validationError: error.array()
            });;
    }


    bcrypt
        .hash(password, 12)
        .then(hashedPwd => {
            const newUser = new User({
                name: name,
                email: email,
                password: hashedPwd,
                cart: {
                    items: []
                }
            });

            return newUser.save();

        })
        .then(result => {
            res.redirect('/login');
            return transport.sendMail({
                to: email,
                from: 'shop@node-complete.com',
                subject: 'Signup Success !',
                html: emailTemplate
            });
        })
        .catch(err => {
            console.log('Error! SignUp.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
        });
};


exports.getReset = (req, res, next) => {
    let message = req.flash('error');
    if (message.length > 0) {
        message = message[0];
    } else {
        message = null;
    }
    res.render('auth/reset', {
        path: '/reset',
        pageTitle: 'Reset Password',
        errorMessage: message
    });
}


exports.postReset = (req, res, next) => {
    crypto.randomBytes(32, (err, buffer) => {
        if (err) {
            console.log(err);
            return res.redirect('/reset');
        }

        const token = buffer.toString('hex');
        const userEmail = req.body.email
        return User.findOne({
                email: userEmail
            })
            .then(user => {
                if (!user) {
                    req.flash('error', 'No account with Email found !');
                    return res.redirect('/reset');
                }
                user.resetToken = token;
                user.resetTokenExpiration = Date.now() + 3600000;
                return user.save();
            })
            .then(result => {
                if (result) {
                    transport.sendMail({
                        to: req.body.email,
                        from: 'shop@node-complete.com',
                        subject: 'Password Reset !',
                        html: `
                        <p>You requested a password reset.</p>
                        <p>Link will expire in 1 hour(s).</p>
                        <br><br>
                        <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password.</p>
                        `
                    });
                    res.redirect('/');
                }
            })
            .catch(err => {
                console.log('Error! Password Reset.');
                const error = new Error(err);
                error.httpStatusCode = 500;
                return next(error);
            });
    });
}


exports.getNewPassword = (req, res, next) => {
    const token = req.params.token;
    User.findOne({
            resetToken: token,
            resetTokenExpiration: {
                $gt: Date.now()
            }
        })
        .then(user => {
            let message = req.flash('error');
            if (message.length > 0) {
                message = message[0];
            } else {
                message = null;
            }
            res.render('auth/new-password', {
                path: '/new-password',
                pageTitle: 'New Password',
                errorMessage: message,
                userId: user._id.toString(),
                passwordToken: token
            });
        }).catch(err => {
            console.log('Error! Getting New Password.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
        });
}


exports.postNewPassword = (req, res, next) => {
    const newPwd = req.body.password;
    const userId = req.body.userId;
    const passwordToken = req.body.passwordToken;

    let resetUser;

    User.findOne({
            resetToken: passwordToken,
            resetTokenExpiration: {
                $gt: Date.now()
            },
            _id: userId
        })
        .then(user => {
            resetUser = user;
            return bcrypt.hash(newPwd, 12);
        })
        .then(hashPwd => {
            resetUser.password = hashPwd;
            resetUser.resetToken = null;
            resetUser.resetTokenExpiration = null;
            return resetUser.save();
        })
        .then(result => {
            res.redirect('/login');
        })
        .catch(err => {
            console.log('Error! Saving Reset Password to DataBase.');
			const error = new Error(err);
			error.httpStatusCode = 500;
			return next(error);
        });
}