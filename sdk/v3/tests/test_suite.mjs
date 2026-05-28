#!/usr/bin/env node

// Comprehensive test suite for users, groups and endpoints.
// Usage: BASE=http://localhost:3000 node tests/test_suite.mjs

const BASE = process.env.BASE || 'http://localhost:3000';

let _totalTests = 0;
let _successTests = 0;

function ok(name) {
    _totalTests++;
    _successTests++;
    console.log('OK: ' + name);
}

function err(name, details) {
    _totalTests++;
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

    // --- ASSIGNMENTS (users <-> groups, endpoints <-> groups) ---
    await post('/register', { username: user, password: 'p' });
    await post('/register-group', { groupname: g1 });
    await post('/register-endpoint', { endpointname: e1 });

    r = await post('/assign-user-to-group', { username: user, groupname: g1 });
    if (r.status === 200) ok('assign user to group'); else { err('assign user to group', r.status + ' ' + r.text); failed = true; }

    r = await post('/assign-user-to-group', { username: user, groupname: g1 });
    if (r.status === 200) ok('assign user to group idempotent'); else { err('assign user to group idempotent', r.status + ' ' + r.text); failed = true; }

    r = await post('/remove-user-from-group', { username: user, groupname: g1 });
    if (r.status === 200) ok('remove user from group'); else { err('remove user from group', r.status + ' ' + r.text); failed = true; }

    r = await post('/remove-user-from-group', { username: user, groupname: g1 });
    if (r.status === 404) ok('remove user from group again'); else { err('remove user from group again', r.status + ' ' + r.text); failed = true; }

    r = await post('/assign-endpoint-to-group', { groupname: g1, endpointname: e1 });
    if (r.status === 200) ok('assign endpoint to group'); else { err('assign endpoint to group', r.status + ' ' + r.text); failed = true; }

    // idempotent assign endpoint -> group
    r = await post('/assign-endpoint-to-group', { groupname: g1, endpointname: e1 });
    if (r.status === 200) ok('assign endpoint to group idempotent'); else { err('assign endpoint to group idempotent', r.status + ' ' + r.text); failed = true; }

    r = await post('/remove-endpoint-from-group', { groupname: g1, endpointname: e1 });
    if (r.status === 200) ok('remove endpoint from group'); else { err('remove endpoint from group', r.status + ' ' + r.text); failed = true; }

    r = await post('/remove-endpoint-from-group', { groupname: g1, endpointname: e1 });
    if (r.status === 404) ok('remove endpoint from group again'); else { err('remove endpoint from group again', r.status + ' ' + r.text); failed = true; }

    // cleanup
    // --- LOGIN / LOGOUT ---
    r = await post('/login', { username: user, password: 'p' });
    if (r.status === 200) ok('login success'); else { err('login success', r.status + ' ' + r.text); failed = true; }

    r = await post('/login', { username: user, password: 'wrong' });
    if (r.status === 401) ok('login wrong password'); else { err('login wrong password', r.status + ' ' + r.text); failed = true; }

    // login non-existing user
    r = await post('/login', { username: 'noexist_' + t, password: 'x' });
    if (r.status === 401) ok('login non-existing user'); else { err('login non-existing user', r.status + ' ' + r.text); failed = true; }

    r = await post('/logout', { username: user });
    if (r.status === 200) ok('logout success'); else { err('logout success', r.status + ' ' + r.text); failed = true; }

    r = await post('/logout', { username: user });
    if (r.status === 404) ok('logout non-existing session'); else { err('logout non-existing session', r.status + ' ' + r.text); failed = true; }

    // --- CHECK endpoints/groups ---
    r = await post('/check-group', { groupname: g1 });
    if (r.status === 200 && r.json && r.json.exists) ok('check group exists'); else { err('check group exists', r.status + ' ' + r.text); failed = true; }

    r = await post('/check-group', { groupname: 'no_g_' + t });
    if (r.status === 200 && r.json && !r.json.exists) ok('check group not exists'); else { err('check group not exists', r.status + ' ' + r.text); failed = true; }

    r = await post('/check-endpoint', { endpointname: e1 });
    if (r.status === 200 && r.json && r.json.exists) ok('check endpoint exists'); else { err('check endpoint exists', r.status + ' ' + r.text); failed = true; }

    r = await post('/check-endpoint', { endpointname: '/noep_' + t });
    if (r.status === 200 && r.json && !r.json.exists) ok('check endpoint not exists'); else { err('check endpoint not exists', r.status + ' ' + r.text); failed = true; }

    // cleanup
    try { await post('/delete-endpoint', { endpointname: e1 }); } catch (e) {}
    try { await post('/delete-group', { groupname: g1 }); } catch (e) {}
    try { await post('/delete-user', { username: user }); } catch (e) {}

    console.log(`Se corrieron ${_totalTests} tests, ${_successTests} fueron exitosos.`);
    if (failed) process.exit(1);
    console.log('All tests finished.');
}

run().catch(function(e) {
    console.error('Fatal error:', e);
    process.exit(1);
});
