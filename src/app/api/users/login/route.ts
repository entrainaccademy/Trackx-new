import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, code, password } = await req.json();
    const identifier = email || code;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "Email/Code and password are required" },
        { status: 400 }
      );
    }

    // Lookup user by email or code
    const userList = await db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.code, identifier)))
      .limit(1);

    if (userList.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const user = userList[0];

    // Check status
    if (user.status && user.status.toLowerCase() === "inactive") {
      return NextResponse.json(
        { success: false, error: "Account is inactive. Please contact your administrator." },
        { status: 403 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { success: false, error: "Password not set for this user." },
        { status: 400 }
      );
    }

    // Compare password with bcrypt hash, fallback to direct comparison for legacy plain text passwords
    let isMatch = await bcrypt.compare(password, user.password).catch(() => false);
    if (!isMatch && user.password === password) {
      isMatch = true;
      // Upgrade plain text password to bcrypt hash in DB
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.update(users).set({ password: hashedPassword }).where(eq(users.id, user.id));
      } catch (upgradeErr) {
        console.warn("Failed to upgrade plain text password:", upgradeErr);
      }
    }

    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Update last login
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

    // Return user info excluding password
    const { password: _p, ...safeUser } = user;

    return NextResponse.json({
      success: true,
      user: safeUser,
    });
  } catch (error: any) {
    console.error("Error in user login:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Login failed" },
      { status: 500 }
    );
  }
}
