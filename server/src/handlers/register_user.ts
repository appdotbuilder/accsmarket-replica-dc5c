import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const registerUser = async (input: RegisterUserInput): Promise<User> => {
  try {
    // Check if user with this email already exists (case-insensitive)
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email.toLowerCase()))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash the password using Bun's built-in password hashing
    const password_hash = await Bun.password.hash(input.password);

    // Insert new user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email.toLowerCase(), // Store email in lowercase
        password_hash,
        role: input.role,
        is_verified: false,
        balance: '0.00' // Convert number to string for numeric column
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const user = result[0];
    return {
      ...user,
      balance: parseFloat(user.balance) // Convert string back to number
    };
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
};