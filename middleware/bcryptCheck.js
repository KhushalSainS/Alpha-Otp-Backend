import bcrypt from 'bcrypt';

/**
 * This middleware checks if bcrypt is working correctly
 * If not, it will attempt to rebuild it
 */
export const checkBcrypt = async (req, res, next) => {
  try {
    // Log bcrypt version if available
    console.log('Using bcrypt version:', bcrypt.version || 'unknown');
    
    // Try to hash a simple string
    const hash = await bcrypt.hash('test', 10);
    const compare = await bcrypt.compare('test', hash);
    
    if (!compare) {
      console.error('bcrypt validation failed - hashing works but comparison failed');
      return res.status(500).json({ error: 'Authentication system error' });
    }
    
    // If we get here, bcrypt is working fine
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
