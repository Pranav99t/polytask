export default function Loading() {
    return (
        <div className="flex h-screen items-center justify-center">
            <div className="text-center space-y-4">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                <p className="text-gray-600">Loading...</p>
            </div>
        </div>
    )
}
