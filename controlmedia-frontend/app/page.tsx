export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">ControlMedia</h1>
      <p className="text-lg text-gray-600 mb-8">
        Optimiza y convertí tus imágenes y videos en segundos.
      </p>
      <a
        href="/image-tool"
        className="inline-block px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
      >
        Optimizar imagen
      </a>
    </main>
  );
}
