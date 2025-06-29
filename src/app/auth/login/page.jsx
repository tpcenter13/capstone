"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../../../firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { AnimatedSection } from "@/app/components/AnimatedSection";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Eye, EyeOff } from "lucide-react";
import { isAuthenticated } from "@/app/utils/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Validate inputs
      if (!email || !password) {
        setError("Please enter both email and password");
        return;
      }

      // Sign in with email and password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Query Firestore for user document
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("uid", "==", userCredential.user.uid));
      const querySnapshot = await getDocs(q);

      // Check if user document exists
      if (querySnapshot.empty) {
        setError("No user data found. Please contact support.");
        return;
      }

      // Get user role from Firestore document
      const userDoc = querySnapshot.docs[0];
      const userRole = userDoc.data().role;

      // Role-based redirection
      const roleMap = {
        user: "/user",
        owner: "/owner",
        admin: "/admin",
      };

      // Redirect if role is valid
      if (roleMap[userRole]) {
        router.push(roleMap[userRole]);
      } else {
        setError("Invalid role assigned to account.");
      }
    } catch (error) {
      // Enhanced error handling
      switch (error.code) {
        case "auth/invalid-credential":
          setError("Invalid email or password");
          break;
        case "auth/user-not-found":
          setError("No account found with this email");
          break;
        case "auth/wrong-password":
          setError("Incorrect password");
          break;
        case "auth/too-many-requests":
          setError("Too many attempts. Please try again later.");
          break;
        default:
          setError("An error occurred. Please try again.");
          console.error("Authentication error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 hero-gradient">
      <AnimatedSection>
        <Card className="w-[400px] border-2 border-[#fdb040]/20">
          <CardHeader>
            <h2 className="text-3xl font-bold text-center text-[#fdb040]">
              Login
            </h2>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="text-red-500 text-sm text-center">{error}</div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="text-gray-700">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="transition-all duration-300 focus:border-[#fdb040] hover:border-[#fdb040]/50"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="transition-all duration-300 focus:border-[#fdb040] hover:border-[#fdb040]/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#fdb040] hover:bg-[#fdb040]/90 text-white transition-all duration-300"
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
              <p className="text-sm text-center text-gray-600">
                <Link
                  href="/auth/forgotpassword"
                  className="text-[#fdb040] hover:text-[#fdb040]/80 hover:underline transition-colors"
                >
                  Forgot Password?
                </Link>
              </p>
              <p className="text-sm text-center text-gray-600">
                Don't have an account?{" "}
                <Link
                  href="/auth/register"
                  className="text-[#fdb040] hover:text-[#fdb040]/80 hover:underline transition-colors"
                >
                  Register here
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </AnimatedSection>
    </div>
  );
}