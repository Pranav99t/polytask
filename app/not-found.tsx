import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="text-center space-y-6 p-8">
                <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold">
                    404
                </div>
                <h1 className="text-3xl font-bold text-gray-900">Page Not Found</h1>
                <p className="text-gray-500 max-w-md">
                    The page you are looking for does not exist or has been moved.
                </p>
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium hover:from-violet-700 hover:to-indigo-700 transition-all"
                >
                    Go to Dashboard
                </Link>
            </div>
        </div>
    );
}
