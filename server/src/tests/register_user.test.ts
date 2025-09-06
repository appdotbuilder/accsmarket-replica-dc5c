import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput } from '../schema';
import { registerUser } from '../handlers/register_user';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: RegisterUserInput = {
  email: 'test@example.com',
  password: 'testpassword123',
  role: 'buyer'
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user', async () => {
    const result = await registerUser(testInput);

    // Basic field validation
    expect(result.email).toEqual('test@example.com');
    expect(result.role).toEqual('buyer');
    expect(result.is_verified).toEqual(false);
    expect(result.balance).toEqual(0);
    expect(typeof result.balance).toEqual('number');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeNull();
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('testpassword123'); // Should be hashed
    expect(result.password_hash.length).toBeGreaterThan(20); // Bcrypt hashes are long
  });

  it('should save user to database', async () => {
    const result = await registerUser(testInput);

    // Query using proper drizzle syntax
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].role).toEqual('buyer');
    expect(users[0].is_verified).toEqual(false);
    expect(parseFloat(users[0].balance)).toEqual(0);
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].password_hash).toBeDefined();
  });

  it('should hash the password correctly', async () => {
    const result = await registerUser(testInput);

    // Verify password was hashed using Bun's password verification
    const isValid = await Bun.password.verify('testpassword123', result.password_hash);
    expect(isValid).toBe(true);

    // Verify wrong password doesn't match
    const isWrongValid = await Bun.password.verify('wrongpassword', result.password_hash);
    expect(isWrongValid).toBe(false);
  });

  it('should register seller role correctly', async () => {
    const sellerInput: RegisterUserInput = {
      email: 'seller@example.com',
      password: 'sellerpassword123',
      role: 'seller'
    };

    const result = await registerUser(sellerInput);

    expect(result.role).toEqual('seller');
    expect(result.email).toEqual('seller@example.com');
  });

  it('should register admin role correctly', async () => {
    const adminInput: RegisterUserInput = {
      email: 'admin@example.com',
      password: 'adminpassword123',
      role: 'admin'
    };

    const result = await registerUser(adminInput);

    expect(result.role).toEqual('admin');
    expect(result.email).toEqual('admin@example.com');
  });

  it('should use default buyer role when not specified', async () => {
    const inputWithoutRole = {
      email: 'defaultrole@example.com',
      password: 'password123'
    };

    // This tests the Zod default value parsing
    const result = await registerUser(inputWithoutRole as RegisterUserInput);

    expect(result.role).toEqual('buyer');
  });

  it('should reject duplicate email addresses', async () => {
    // Register first user
    await registerUser(testInput);

    // Try to register another user with same email
    const duplicateInput: RegisterUserInput = {
      email: 'test@example.com', // Same email
      password: 'differentpassword123',
      role: 'seller'
    };

    await expect(registerUser(duplicateInput)).rejects.toThrow(/already exists/i);
  });

  it('should handle different email case sensitivity', async () => {
    // Register user with lowercase email
    await registerUser(testInput);

    // Try to register with uppercase email - PostgreSQL treats emails case-insensitively
    const uppercaseEmailInput: RegisterUserInput = {
      email: 'TEST@EXAMPLE.COM',
      password: 'password123',
      role: 'buyer'
    };

    // Our application logic should prevent this by checking existing emails
    await expect(registerUser(uppercaseEmailInput)).rejects.toThrow(/already exists/i);
  });

  it('should generate unique IDs for multiple users', async () => {
    const user1Input: RegisterUserInput = {
      email: 'user1@example.com',
      password: 'password123',
      role: 'buyer'
    };

    const user2Input: RegisterUserInput = {
      email: 'user2@example.com',
      password: 'password123',
      role: 'seller'
    };

    const user1 = await registerUser(user1Input);
    const user2 = await registerUser(user2Input);

    expect(user1.id).not.toEqual(user2.id);
    expect(user1.email).not.toEqual(user2.email);
    expect(user1.id).toBeGreaterThan(0);
    expect(user2.id).toBeGreaterThan(0);
  });

  it('should handle numeric balance field correctly', async () => {
    const result = await registerUser(testInput);

    // Verify balance is stored as string in database but returned as number
    const dbUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(typeof dbUser[0].balance).toEqual('string'); // Stored as string
    expect(dbUser[0].balance).toEqual('0.00'); // Default value
    expect(typeof result.balance).toEqual('number'); // Returned as number
    expect(result.balance).toEqual(0); // Converted value
  });
});