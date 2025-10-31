// Simple smoke test for booking flow: register -> get locations -> find vehicle -> create booking -> create checkout session
const BASE = process.env.API_URL || 'http://localhost:5000/api';
const fetch = global.fetch || require('node-fetch');
(async () => {
  try {
    const ts = Date.now();
    const email = `smoketest+${ts}@example.com`;
    console.log('Registering user', email);
    let res = await fetch(`${BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Smoke Tester', email, password: 'Password123!' }) });
    const reg = await res.json();
    if (!reg || !reg.success) {
      console.error('Register failed', reg);
      return process.exit(1);
    }
    const token = reg.data?.token || reg.token;
    console.log('Registered OK, token present?', !!token);

    // get locations
    res = await fetch(`${BASE}/locations`);
    const locs = await res.json();
    let location = (locs.data && locs.data[0]) || null;
    if (!location) {
      console.warn('No locations found, will try to infer a location from a vehicle');
    }

    // try availability for tomorrow
    const start = new Date(); start.setDate(start.getDate()+1);
    const end = new Date(start); end.setDate(end.getDate()+2);
    const startDate = start.toISOString().slice(0,10);
    const endDate = end.toISOString().slice(0,10);

    console.log('Query available vehicles', startDate, endDate, location?.code || 'City Center');
    res = await fetch(`${BASE}/vehicles/available?startDate=${startDate}&endDate=${endDate}&locationCode=${encodeURIComponent(location?.code||'City Center')}`);
    const avail = await res.json();
    console.log('Availability response:', avail && avail.success);
    let vehicleId = null;
    if (avail && avail.data && Array.isArray(avail.data.results) && avail.data.results.length > 0) {
      vehicleId = avail.data.results[0].vehicle.id;
      if (!location && avail.data.results[0].vehicle.locationId) location = { id: avail.data.results[0].vehicle.locationId, code: avail.data.results[0].vehicle.location?.code };
    } else {
      // fallback: list vehicles
      res = await fetch(`${BASE}/vehicles`);
      const vlist = await res.json();
      if (vlist && vlist.data && vlist.data.vehicles && vlist.data.vehicles.length) {
        vehicleId = vlist.data.vehicles[0].id;
        if (!location && vlist.data.vehicles[0].locationId) location = { id: vlist.data.vehicles[0].locationId, code: vlist.data.vehicles[0].location?.code };
      }
    }
    if (!vehicleId) {
      console.error('No vehicle found to create booking');
      return process.exit(1);
    }

    console.log('Creating booking for vehicle', vehicleId);
  res = await fetch(`${BASE}/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ vehicleId, locationPickupId: location?.id || null, locationDropoffId: location?.id || null, startDate, endDate }) });
    const bookingRes = await res.json();
    console.log('Booking created:', bookingRes && bookingRes.success);
    const bookingId = bookingRes?.data?.booking?.id || bookingRes?.booking?.id || bookingRes?.data?.id;
    if (!bookingId) {
      console.error('Booking creation failed', bookingRes);
      return process.exit(1);
    }

    console.log('Creating checkout session (may return 501 if Stripe not configured)');
    res = await fetch(`${BASE}/payments/create-checkout-session`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ bookingId }) });
    const sessionRes = await res.json();
    console.log('Checkout session response:', sessionRes);
    console.log('Smoke test finished');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test error', err);
    process.exit(1);
  }
})();
