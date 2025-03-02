import bcrypt from 'bcryptjs';

/**
 * This middleware checks if bcrypt is working correctly
 */
export const checkBcrypt = async (req, res, next) => {
  try {
    // Log bcrypt version if available
    console.log('Using bcryptjs');
    
    // Try to hash a simple string
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('test', salt);
    const compare = await bcrypt.compare('test', hash);
    
    if (!compare) {
      console.error('bcrypt validation failed - hashing works but comparison failed');
      return res.status(500).json({ error: 'Authentication system error' });
    }
    
    // If we get here, bcrypt is working fine
    console.log('bcryptjs validation successful');
    next();
  } catch (error) {
    console.error('bcrypt error:', error);
    return res.status(500).json({ 
      error: 'Authentication system error', 
      details: 'bcrypt module failed to load properly'
    });
  }
};

export default checkBcrypt;
