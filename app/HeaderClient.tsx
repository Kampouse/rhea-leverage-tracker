'use client';

export default function HeaderClient() {
  const handleSearch = async () => {
    const address = prompt('Enter NEAR address to search:');
    if (!address || address.length < 10) return;

    try {
      const res = await fetch(`/api/trader?address=${encodeURIComponent(address)}`);
      if (!res.ok) {
        alert('Address not found or invalid');
        return;
      }

      const data = await res.json();
      
      if (data.totalTrades === 0 && !data.isCached) {
        alert('No trading history found for this address');
        return;
      }

      // Trigger the global handler
      if ((window as any).handleTraderFound) {
        (window as any).handleTraderFound(data);
      }
    } catch (e) {
      alert('Search failed');
    }
  };

  return (
    <button
      onClick={handleSearch}
      className="p-2 rounded-lg bg-cream/5 text-taupe hover:bg-cream/10 hover:text-cream transition-colors"
      title="Search trader by address"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>
  );
}
