import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, timingSafeEqual } from 'crypto';

export async function loginUser(input: LoginUserInput): Promise<User | null> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      return null; // User not found
    }

    const user = users[0];

    // Verify password using simple hash comparison (for demonstration)
    // In production, use proper password hashing like bcrypt or Argon2
    const hashedInputPassword = createHash('sha256').update(input.password).digest('hex');
    const isValidPassword = timingSafeEqual(
      Buffer.from(user.password_hash, 'hex'),
      Buffer.from(hashedInputPassword, 'hex')
    );
    
    if (!isValidPassword) {
      return null; // Invalid password
    }

    // Convert numeric fields back to numbers before returning
    return {
      ...user,
      balance: parseFloat(user.balance)
    };
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
}