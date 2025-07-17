import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto p-4">

        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">ClockSynk</h1>
            <p className="text-sm text-gray-400">Youth Sports Scoreboard</p>
          </div>
          <div className="space-x-2">
            <button className="bg-green-500 px-3 py-1 rounded text-white">Spectator</button>
            <button className="bg-blue-500 px-3 py-1 rounded text-white">Scorekeeper</button>
          </div>
        </header>

        {/* Trial Banner */}
        <div className="bg-blue-500 text-white rounded-md py-4 text-center mb-6">
          <h2 className="text-xl font-semibold">Sports Performance Training</n            </h2>
          <p className="text-sm">Free Trial</p>
        </div>

        {/* Scoreboard */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">

          {/* HOME */}
          <div className="flex flex-col items-center w-full md:w-1/4">
            <h2 className="text-xl md:text-2xl font-bold">HOME</h2>
            <span className="text-4xl md:text-6xl">0</span>
            <div className="mt-2 flex space-x-2">
              <button className="bg-green-500 text-white p-2 rounded">+</button>
              <button className="bg-red-500 text-white p-2 rounded">−</button>
            </div>
          </div>

          {/* TIMER */}
          <div className="flex flex-col items-center w-full md:w-1/2">
            <span className="uppercase text-sm mb-1">Period</span>
            <div className="flex items-center space-x-3">
              <button className="bg-gray-700 text-white p-1 rounded">−</button>
              <span className="text-4xl md:text-6xl font-mono">15:00</span>
              <button className="bg-gray-700 text-white p-1 rounded">+</button>
            </div>
            <div className="mt-4 flex space-x-2">
              <button className="bg-green-500 text-white px-4 py-2 rounded flex items-center space-x-1">
                <span>▶️</span><span>Play</span>
              </button>
              <button className="bg-gray-700 text-white px-4 py-2 rounded flex items-center space-x-1">
                <span>🔄</span><span>Reset</span>
              </button>
            </div>
          </div>

          {/* AWAY */}
          <div className="flex flex-col items-center w-full md:w-1/4">
            <h2 className="text-xl md:text-2xl font-bold">AWAY</h2>
            <span className="text-4xl md:text-6xl">0</span>
            <div className="mt-2 flex space-x-2">
              <button className="bg-green-500 text-white p-2 rounded">+</button>
              <button className="bg-red-500 text-white p-2 rounded">−</button>
            </div>
          </div>

        </div>

        {/* Penalties */}
        <section className="mt-8">
          <h3 className="flex items-center text-lg font-semibold">
            <span className="mr-2">⚠️</span>Penalties
          </h3>
          <p className="text-center text-gray-400 mt-2">No active penalties</p>
        </section>

        {/* Ad Cards / Placeholders */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-red-500 p-4 rounded text-white">
            <h4 className="text-lg font-bold">Fitness Center</h4>
            <p className="text-sm">Strength Training</p>
          </div>
          <div className="bg-green-500 p-4 rounded text-white">
            <h4 className="text-lg font-bold">Sports Drinks</h4>
            <p className="text-sm">Stay Hydrated</p>
          </div>
          <div className="bg-blue-500 p-4 rounded text-white">
            <h4 className="text-lg font-bold">Team Banners</h4>
            <p className="text-sm">Custom Design</p>
          </div>
          <div className="bg-yellow-500 p-4 rounded text-white">
            <h4 className="text-lg font-bold">Lacrosse Cages</h4>
            <p className="text-sm">Goal Practice</p>
          </div>
        </div>

      </div>
    </div>
  );
}
