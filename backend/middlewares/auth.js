const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    console.log(`🔒 Auth middleware called for ${req.method} ${req.originalUrl}`);
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('🔑 Token found in authorization header');
    } else {
      console.log('❌ No authorization header or invalid format');
    }

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      console.log('🔍 Verifying JWT token...');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ JWT token verified, user ID:', decoded.id);
      
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        console.log('❌ User not found in database for ID:', decoded.id);
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      console.log('✅ User authenticated:', { 
        id: req.user._id, 
        fullName: req.user.fullName, 
        userType: req.user.userType 
      });
      
      next();
    } catch (error) {
      console.log('❌ JWT verification failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    // Flatten array if first argument is an array
    const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;
    
    console.log(`🔐 Authorization check - Required: [${allowedRoles.join(', ')}], User: ${req.user.userType}`);
    
    if (!allowedRoles.includes(req.user.userType)) {
      console.log(`❌ Authorization failed: User ${req.user.fullName} (${req.user.userType}) not in allowed roles [${allowedRoles.join(', ')}]`);
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.userType} is not authorized to access this route`
      });
    }
    
    console.log(`✅ Authorization passed for ${req.user.fullName} (${req.user.userType})`);
    next();
  };
};

module.exports = {
  protect,
  authorize
};