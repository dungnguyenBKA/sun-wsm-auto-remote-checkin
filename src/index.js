import axios from "axios";
import qs from "qs";
import * as cheerio from 'cheerio';

// Base URL for WSM
const BASE_URL = 'https://wsm.sun-asterisk.vn';

const email = process.env.EMAIL
const password = process.env.PASSWORD

function addCookies(current, addMore) {
    if (!addMore) return current;

    const cookieMap = new Map();
    current.forEach((cookie) => {
        const [key, ...value] = cookie.split('=');
        cookieMap.set(key.trim(), value.join('=').trim());
    });
    addMore.forEach((cookie) => {
        const [key, ...value] = cookie.split('=');
        cookieMap.set(key.trim(), value.join('=').trim());
    });
    return Array.from(cookieMap.entries()).map(([key, value]) => `${key}=${value}`);
}

const instance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
})

async function performCheckInFlow() {
    let csrfToken = null;
    let cookies = [];

    // Step 1: Access the homepage
    console.log('Step 1: Accessing homepage...');
    let response = await instance.get(`/`);
    if (response.status === 200) {
        console.log('Homepage loaded successfully');
        cookies = addCookies(cookies, response.headers["set-cookie"]);

        const $ = cheerio.load(response.data);
        csrfToken = $('meta[name="csrf-token"]').attr('content');
    } else {
        throw new Error('Failed to load homepage');
    }

    // Step 2: Check if core values are displayed
    console.log('Step 2: Checking core values display status...');
    response = await instance.get(`/can_show_core_values`, {
        params: {
            user_email: email
        }
    });
    if (response.status === 200) {
        console.log('Core values display status:', response.data);
    } else {
        throw new Error('Failed to check core values display status');
    }


    // Step 3: Log in to the system
    console.log('Step 3: Logging in...');

    const step3Data = qs.stringify({
        'utf8': '✓',
        'authenticity_token': csrfToken,
        'user[token_core_value]': '',
        'user[email]': email,
        'user[password]': password,
        'user[remember_me]': '0'
    });

    response = await instance.post(`/en/users/sign_in`, step3Data, {
        headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-csrf-token': csrfToken,
            'x-requested-with': 'XMLHttpRequest',
            'cookie': cookies.join(';')
        },
    });
    if (response.status === 200 && response.data) {
        console.log('Login successful', response.data);
        cookies = addCookies(cookies, response.headers["set-cookie"]);
    } else {
        console.log({response: response.data});
        throw new Error('Login failed');
    }

    // Step 4: Access user timesheets dashboard
    console.log('Step 4: Accessing user timesheets dashboard...');
    response = await instance.get(`/vi/dashboard/user_timesheets`, {
        headers: {
            'accept': '*/*',
            'x-csrf-token': csrfToken,
            'x-requested-with': 'XMLHttpRequest',
            'cookie': cookies.join(';')
        }
    });

    let csrfToken2 = null

    if (response.status === 200) {
        console.log('User timesheets dashboard loaded successfully');
        const $ = cheerio.load(response.data);
        csrfToken2 = $('meta[name="csrf-token"]').attr('content');
        cookies = addCookies(cookies, response.headers["set-cookie"]);
    } else {
        throw new Error('Failed to load user timesheets dashboard');
    }

    // Step 5: Perform remote Check-in
    console.log('Step 5: Performing remote Check-in...');

    const step5Data = qs.stringify({
        '_method': 'patch',
        'authenticity_token': csrfToken2,
    });
    const cookie = cookies.join(';');

    response = await instance.post(
        `/vi/dashboard/checkout_remotes`,
        step5Data,
        {
            headers: {
                'accept': '*/*;q=0.5, text/javascript, application/javascript, application/ecmascript, application/x-ecmascript',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'cookie': cookie,
                'x-csrf-token': csrfToken2,
                'x-requested-with': 'XMLHttpRequest'
            }
        }
    );

    if (response.status === 200 && response.data) {
        console.log('Check-in result:', response.data);
    } else {
        throw new Error('Check-in failed');
    }
}

// Execute the Check-in flow
performCheckInFlow().catch(error => {
    console.error('Error during Check-in flow:')
    if (error.message) {
        console.error(error.message);
    }
})
