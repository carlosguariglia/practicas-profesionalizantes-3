#!/usr/bin/env node

// Comprehensive test suite for users, groups and endpoints.
// Usage: BASE=http://localhost:3000 node tests/test_suite.mjs

const BASE = process.env.BASE || 'http://localhost:3000';

function ok(name) {
    console.log('OK: ' + name);
}

function err(name, details) {
    console.error('ERROR: ' + name + (details ? ' - ' + details : ''));
}

async function post(path, body) {
    const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch(e) {}
    return { status: res.status, text: text, json: json };
}

async function run() {
    let failed = false;
    const t = Date.now();

    // --- USERS ---
    const user = 'u_' + t;
    const user2 = 'u2_' + t;

    let r = await post('/register', { username: user, password: 'p' });
    if (r.status === 200) ok('create user'); else { err('create user', r.status + ' ' + r.text); failed = true; }

    r = await post('/register', { username: user, password: 'p' });
    if (r.status === 409) ok('create existing user'); else { err('create existing user', r.status + ' ' + r.text); failed = true; }

    r = await post('/delete-user', { username: user });
    if (r.status === 200) ok('delete existing user'); else { err('delete existing user', r.status + ' ' + r.text); failed = true; }

    r = await post('/delete-user', { username: user });
    if (r.status === 404) ok('delete non-existing user'); else { err('delete non-existing user', r.status + ' ' + r.text); failed = true; }

    await post('/register', { username: user, password: 'p' });
    await post('/register', { username: user2, password: 'p2' });

    r = await post('/update-user', { username: user, newPassword: 'newp' });
    if (r.status === 200) ok('modify user (password)'); else { err('modify user (password)', r.status + ' ' + r.text); failed = true; }

    r = await post('/update-user', { username: user, newUsername: user2 });
    if (r.status === 409) ok('modify username to existing'); else { err('modify username to existing', r.status + ' ' + r.text); failed = true; }

    r = await post('/update-user', { username: 'noexist_' + t, newPassword: 'x' });
    if (r.status === 404) ok('modify non-existing user'); else { err('modify non-existing user', r.status + ' ' + r.text); failed = true; }

    try { await post('/delete-user', { username: user }); } catch (e) {}
    try { await post('/delete-user', { username: user2 }); } catch (e) {}

    // --- GROUPS ---
    const g1 = 'g_' + t;
    const g2 = 'g2_' + t;

    r = await post('/register-group', { groupname: g1 });
    if (r.status === 200) ok('create group'); else { err('create group', r.status + ' ' + r.text); failed = true; }

    r = await post('/register-group', { groupname: g1 });
    if (r.status === 409) ok('create existing group'); else { err('create existing group', r.status + ' ' + r.text); failed = true; }

    r = await post('/delete-group', { groupname: g1 });
    if (r.status === 200) ok('delete existing group'); else { err('delete existing group', r.status + ' ' + r.text); failed = true; }

    r = await post('/delete-group', { groupname: g1 });
    if (r.status === 404) ok('delete non-existing group'); else { err('delete non-existing group', r.status + ' ' + r.text); failed = true; }

    await post('/register-group', { groupname: g1 });
    await post('/register-group', { groupname: g2 });

    r = await post('/update-group', { groupname: g1, newGroupname: g1 + '_new' });
    if (r.status === 200) ok('modify group'); else { err('modify group', r.status + ' ' + r.text); failed = true; }

    r = await post('/update-group', { groupname: g1 + '_new', newGroupname: g2 });
    if (r.status === 409) ok('modify group to existing'); else { err('modify group to existing', r.status + ' ' + r.text); failed = true; }

    r = await post('/update-group', { groupname: 'no_g_' + t, newGroupname: 'x' });
    if (r.status === 404) ok('modify non-existing group'); else { err('modify non-existing group', r.status + ' ' + r.text); failed = true; }

    try { await post('/delete-group', { groupname: g2 }); } catch (e) {}
    try { await post('/delete-group', { groupname: g1 + '_new' }); } catch (e) {}

    // --- ENDPOINTS ---
    const e1 = '/ep_' + t;
    const e2 = '/ep2_' + t;

    r = await post('/register-endpoint', { endpointname: e1 });
    if (r.status === 200) ok('create endpoint'); else { err('create endpoint', r.status + ' ' + r.text); failed = true; }

    r = await post('/register-endpoint', { endpointname: e1 });
    if (r.status === 409) ok('create existing endpoint'); else { err('create existing endpoint', r.status + ' ' + r.text); failed = true; }

    r = await post('/delete-endpoint', { endpointname: e1 });
    if (r.status === 200) ok('delete existing endpoint'); else { err('delete existing endpoint', r.status + ' ' + r.text); failed = true; }

    r = await post('/delete-endpoint', { endpointname: e1 });
    if (r.status === 404) ok('delete non-existing endpoint'); else { err('delete non-existing endpoint', r.status + ' ' + r.text); failed = true; }

    await post('/register-endpoint', { endpointname: e1 });
    await post('/register-endpoint', { endpointname: e2 });

    r = await post('/update-endpoint', { endpointname: e1, newEndpointname: e1 + '_new' });
    if (r.status === 200) ok('modify endpoint'); else { err('modify endpoint', r.status + ' ' + r.text); failed = true; }

    r = await post('/update-endpoint', { endpointname: e1 + '_new', newEndpointname: e2 });
    if (r.status === 409) ok('modify endpoint to existing'); else { err('modify endpoint to existing', r.status + ' ' + r.text); failed = true; }

    r = await post('/update-endpoint', { endpointname: '/noep_' + t, newEndpointname: 'x' });
    if (r.status === 404) ok('modify non-existing endpoint'); else { err('modify non-existing endpoint', r.status + ' ' + r.text); failed = true; }

    try { await post('/delete-endpoint', { endpointname: e2 }); } catch (e) {}
    try { await post('/delete-endpoint', { endpointname: e1 + '_new' }); } catch (e) {}

    if (failed) process.exit(1);
    console.log('All tests finished.');
}

run().catch(function(e) {
    console.error('Fatal error:', e);
    process.exit(1);
});
