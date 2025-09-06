import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput } from '../schema';
import { loginUser } from '../handlers/login_user';
import { createHash } from 'crypto';

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testUserData = {
    email: 'test@example.com',
    password: 'password123',
    role: 'buyer' as const,
    is_verified: false,
    balance: '25.50'
  };

  const validLoginInput: LoginUserInput = {
    email: 'test@example.com',
    password: 'password123'
  };

  it('should successfully login with valid credentials', async () => {
    // Create test user with hashed password
    const hashedPassword = createHash('sha256').update(testUserData.password).digest('hex');
    
    await db.insert(usersTable).values({
      email: testUserData.email,
      password_hash: hashedPassword,
      role: testUserData.role,
      is_verified: testUserData.is_verified,
      balance: testUserData.balance
    }).execute();

    const result = await loginUser(validLoginInput);

    expect(result).not.toBeNull();
    expect(result!.email).toBe(testUserData.email);
    expect(result!.role).toBe(testUserData.role);
    expect(result!.is_verified).toBe(testUserData.is_verified);
    expect(result!.balance).toBe(25.50); // Numeric conversion
    expect(typeof result!.balance).toBe('number');
    expect(result!.id).toBeDefined();
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent email', async () => {
    const nonExistentInput: LoginUserInput = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    const result = await loginUser(nonExistentInput);

    expect(result).toBeNull();
  });

  it('should return null for incorrect password', async () => {
    // Create test user
    const hashedPassword = createHash('sha256').update(testUserData.password).digest('hex');
    
    await db.insert(usersTable).values({
      email: testUserData.email,
      password_hash: hashedPassword,
      role: testUserData.role,
      is_verified: testUserData.is_verified,
      balance: testUserData.balance
    }).execute();

    const incorrectPasswordInput: LoginUserInput = {
      email: testUserData.email,
      password: 'wrongpassword'
    };

    const result = await loginUser(incorrectPasswordInput);

    expect(result).toBeNull();
  });

  it('should login user with different role (seller)', async () => {
    // Create seller user
    const hashedPassword = createHash('sha256').update(testUserData.password).digest('hex');
    
    await db.insert(usersTable).values({
      email: 'seller@example.com',
      password_hash: hashedPassword,
      role: 'seller',
      is_verified: true,
      balance: '150.75'
    }).execute();

    const sellerLoginInput: LoginUserInput = {
      email: 'seller@example.com',
      password: testUserData.password
    };

    const result = await loginUser(sellerLoginInput);

    expect(result).not.toBeNull();
    expect(result!.email).toBe('seller@example.com');
    expect(result!.role).toBe('seller');
    expect(result!.is_verified).toBe(true);
    expect(result!.balance).toBe(150.75);
    expect(typeof result!.balance).toBe('number');
  });

  it('should login user with admin role', async () => {
    // Create admin user
    const hashedPassword = createHash('sha256').update('admin123').digest('hex');
    
    await db.insert(usersTable).values({
      email: 'admin@example.com',
      password_hash: hashedPassword,
      role: 'admin',
      is_verified: true,
      balance: '0.00'
    }).execute();

    const adminLoginInput: LoginUserInput = {
      email: 'admin@example.com',
      password: 'admin123'
    };

    const result = await loginUser(adminLoginInput);

    expect(result).not.toBeNull();
    expect(result!.email).toBe('admin@example.com');
    expect(result!.role).toBe('admin');
    expect(result!.is_verified).toBe(true);
    expect(result!.balance).toBe(0);
    expect(typeof result!.balance).toBe('number');
  });

  it('should handle case-sensitive email matching', async () => {
    // Create user with lowercase email
    const hashedPassword = createHash('sha256').update(testUserData.password).digest('hex');
    
    await db.insert(usersTable).values({
      email: testUserData.email.toLowerCase(),
      password_hash: hashedPassword,
      role: testUserData.role,
      is_verified: testUserData.is_verified,
      balance: testUserData.balance
    }).execute();

    // Try to login with uppercase email
    const uppercaseEmailInput: LoginUserInput = {
      email: testUserData.email.toUpperCase(),
      password: testUserData.password
    };

    const result = await loginUser(uppercaseEmailInput);

    // Should return null since email is case-sensitive
    expect(result).toBeNull();
  });

  it('should handle zero balance correctly', async () => {
    // Create user with zero balance
    const hashedPassword = createHash('sha256').update(testUserData.password).digest('hex');
    
    await db.insert(usersTable).values({
      email: testUserData.email,
      password_hash: hashedPassword,
      role: testUserData.role,
      is_verified: testUserData.is_verified,
      balance: '0.00'
    }).execute();

    const result = await loginUser(validLoginInput);

    expect(result).not.toBeNull();
    expect(result!.balance).toBe(0);
    expect(typeof result!.balance).toBe('number');
  });
});