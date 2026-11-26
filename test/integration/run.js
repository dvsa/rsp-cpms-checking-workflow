const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const buildDirectory = path.join(root, 'build');
const reportDirectory = path.join(root, 'integration-results');
const lockPath = path.join(reportDirectory, 'run.lock');
const functionName = 'rsp-cpms-checking-dev-checkForOrphanedPayments';
const scenarioNames = [
	'Existing individual payment is returned without downstream lookups',
	'Confirmed individual payment is persisted and returned on replay',
	'Confirmed group payment is persisted and returned on replay',
	'Cancelled payment exits without document lookup or persistence',
];

const runTimestamp = new Date();
const reportBasename = `run-${runTimestamp.toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
const report = {
	timestamp: runTimestamp.toISOString(),
	runtime: process.version,
	target: 'Loopback-only mock AWS Secrets Manager, Payments, CPMS, Documents, and Serverless Offline',
	safetyGates: {
		syntheticFixturesOnly: true,
		externalNetworkTargets: false,
		sharedWrites: false,
		realAwsCredentials: false,
	},
	handlerInventory: [{
		exportName: 'handler',
		localFunction: 'checkForOrphanedPayments',
		interface: 'SQS event; no HTTP business route',
		localTransport: `POST /2015-03-31/functions/${functionName}/invocations`,
		scenarios: scenarioNames,
	}],
	knownDefects: [{
		label: 'Group payment receipt reference is omitted',
		details: 'The handler passes receiptReference, while the group payload builder reads ReceiptReference; current behavior persists PaymentDetail without PaymentRef.',
		status: 'characterized, not fixed',
	}],
	setup: { status: 'not-run', stages: [] },
	scenarios: [],
	cleanup: { status: 'not-run', details: [] },
	limitations: [
		'Downstream AWS and service APIs are represented by loopback fixtures, not real deployments.',
		'This suite characterizes the SQS handler workflow; it does not verify AWS SQS delivery, retry scheduling, or deployed IAM.',
	],
};

const state = {
	requests: [],
	payments: new Map(),
	groupPayments: new Map(),
	documents: new Map(),
	groupDocuments: new Map(),
	cpmsResponses: new Map(),
};

let lockFd;
let mockServer;
let offlineProcess;
let invocationUrl;
let mockPort;
let scenarioNumber = 0;
let hadFailure = false;

function log(message) {
	console.log(`[integration] ${message}`);
}

function safeError(error) {
	return error && typeof error.message === 'string'
		? error.message
		: 'An unknown test-runner error occurred';
}

function addStage(name, status, details) {
	report.setup.stages.push({ name, status, details });
	log(`${name}: ${status}${details ? ` (${details})` : ''}`);
}

function resetScenario() {
	state.requests = [];
	state.payments = new Map();
	state.groupPayments = new Map();
	state.documents = new Map();
	state.groupDocuments = new Map();
	state.cpmsResponses = new Map();
}

function sendJson(response, statusCode, data) {
	response.writeHead(statusCode, { 'content-type': 'application/x-amz-json-1.1' });
	response.end(JSON.stringify(data));
}

function readJson(request) {
	return new Promise((resolve, reject) => {
		let body = '';
		request.setEncoding('utf8');
		request.on('data', (chunk) => {
			body += chunk;
			if (body.length > 1024 * 1024) {
				reject(new Error('Mock service request exceeded its local size limit'));
				request.destroy();
			}
		});
		request.on('end', () => {
			try {
				resolve(body ? JSON.parse(body) : {});
			} catch (error) {
				reject(new Error('Mock service received invalid JSON'));
			}
		});
		request.on('error', reject);
	});
}

function createMockServer() {
	return http.createServer(async (request, response) => {
		const requestUrl = new URL(request.url, 'http://127.0.0.1');
		let body = {};
		if (request.method === 'POST' || request.method === 'PUT') {
			try {
				body = await readJson(request);
			} catch (error) {
				sendJson(response, 400, { message: 'Invalid synthetic fixture request' });
				return;
			}
		}

		if (requestUrl.pathname === '/' && request.headers['x-amz-target'] === 'secretsmanager.GetSecretValue') {
			state.requests.push({ service: 'secrets-manager', method: request.method, path: '/' });
			if (body.SecretId !== 'dummy-integration-secret') {
				sendJson(response, 404, { __type: 'ResourceNotFoundException', message: 'Dummy secret not found' });
				return;
			}
			sendJson(response, 200, {
				ARN: 'arn:aws:secretsmanager:eu-west-1:000000000000:secret:dummy-integration-secret',
				Name: 'dummy-integration-secret',
				VersionId: 'dummy-version',
				SecretString: JSON.stringify({
					CLIENT_ID: 'dummy-client-id',
					CLIENT_SECRET: 'dummy-client-secret',
					REGION: 'eu-west-1',
					PAYMENT_SERVICE_URL: `http://127.0.0.1:${mockPort}/payments-api/`,
					CPMS_SERVICE_URL: `http://127.0.0.1:${mockPort}/cpms-api/`,
					DOCUMENT_SERVICE_URL: `http://127.0.0.1:${mockPort}/documents-api/`,
				}),
			});
			return;
		}

		const paymentPrefix = '/payments-api';
		const cpmsPrefix = '/cpms-api';
		const documentsPrefix = '/documents-api';
		const service = requestUrl.pathname.startsWith(paymentPrefix) ? 'payments'
			: requestUrl.pathname.startsWith(cpmsPrefix) ? 'cpms'
				: requestUrl.pathname.startsWith(documentsPrefix) ? 'documents' : undefined;
		if (!service) {
			sendJson(response, 404, { message: 'No synthetic fixture route matched' });
			return;
		}

		const servicePath = requestUrl.pathname.slice(`/${service}-api`.length);
		state.requests.push({ service, method: request.method, path: servicePath, body });

		if (service === 'payments') {
			if (request.method === 'GET' && servicePath.startsWith('/payments/')) {
				const paymentId = decodeURIComponent(servicePath.slice('/payments/'.length));
				if (state.payments.has(paymentId)) {
					sendJson(response, 200, state.payments.get(paymentId));
				} else {
					sendJson(response, 404, { message: 'Dummy payment not found' });
				}
				return;
			}
			if (request.method === 'POST' && servicePath === '/payments') {
				state.payments.set(body.PenaltyReference, body);
				sendJson(response, 200, body);
				return;
			}
			if (request.method === 'GET' && servicePath.startsWith('/groupPayments/')) {
				const groupId = decodeURIComponent(servicePath.slice('/groupPayments/'.length));
				if (state.groupPayments.has(groupId)) {
					sendJson(response, 200, state.groupPayments.get(groupId));
				} else {
					sendJson(response, 404, { message: 'Dummy group payment not found' });
				}
				return;
			}
			if (request.method === 'POST' && servicePath === '/groupPayments') {
				const group = state.groupPayments.get(body.PaymentCode) || { Payments: {} };
				group.Payments[body.PenaltyType] = body;
				state.groupPayments.set(body.PaymentCode, group);
				sendJson(response, 200, body);
				return;
			}
		}

		if (service === 'cpms' && request.method === 'POST' && servicePath === '/confirm') {
			const result = state.cpmsResponses.get(body.receipt_reference);
			if (result) {
				sendJson(response, 200, result);
			} else {
				sendJson(response, 503, { message: 'No dummy CPMS response was configured' });
			}
			return;
		}

		if (service === 'documents' && request.method === 'GET' && servicePath.startsWith('/documents/')) {
			const documentId = decodeURIComponent(servicePath.slice('/documents/'.length));
			if (state.documents.has(documentId)) {
				sendJson(response, 200, state.documents.get(documentId));
			} else {
				sendJson(response, 404, { message: 'Dummy document not found' });
			}
			return;
		}
		if (service === 'documents' && request.method === 'GET' && servicePath.startsWith('/penaltyGroup/')) {
			const documentId = decodeURIComponent(servicePath.slice('/penaltyGroup/'.length));
			if (state.groupDocuments.has(documentId)) {
				sendJson(response, 200, state.groupDocuments.get(documentId));
			} else {
				sendJson(response, 404, { message: 'Dummy penalty group not found' });
			}
			return;
		}

		sendJson(response, 404, { message: 'No synthetic fixture route matched' });
	});
}

async function listenLoopback(server) {
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', resolve);
	});
	return server.address().port;
}

async function findFreePort() {
	const server = net.createServer();
	const port = await listenLoopback(server);
	await new Promise((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
	return port;
}

function buildService() {
	log('build: compiling the local Lambda bundle');
	const npmCli = process.env.npm_execpath;
	const command = npmCli ? process.execPath : 'npm';
	const args = npmCli ? [npmCli, 'run', 'build'] : ['run', 'build'];
	const result = spawnSync(command, args, {
		cwd: root,
		encoding: 'utf8',
		env: { ...process.env },
		timeout: 120000,
	});
	if (result.error) throw new Error('Local Lambda build could not start');
	if (result.status !== 0) throw new Error(`Local Lambda build failed with exit code ${result.status}`);
	addStage('build', 'passed', 'Local webpack build completed');
}

async function startOffline() {
	log('preflight: creating loopback fixture server and local Lambda transport');
	mockServer = createMockServer();
	mockPort = await listenLoopback(mockServer);
	const lambdaPort = await findFreePort();
	const offlineCli = path.join(root, 'node_modules', 'osls', 'bin', 'serverless.js');
	invocationUrl = `http://127.0.0.1:${lambdaPort}/2015-03-31/functions/${encodeURIComponent(functionName)}/invocations`;
	const environment = {
		PATH: process.env.PATH || '',
		HOME: process.env.HOME || '',
		TMPDIR: process.env.TMPDIR || '/tmp',
		AWS_ENDPOINT_URL: `http://127.0.0.1:${mockPort}`,
		AWS_ACCESS_KEY_ID: 'dummy-local-access-key',
		AWS_SECRET_ACCESS_KEY: 'dummy-local-secret-key',
		AWS_SESSION_TOKEN: 'dummy-local-session-token',
		AWS_EC2_METADATA_DISABLED: 'true',
		AWS_REGION: 'eu-west-1',
		SECRETS_MANAGER_SECRET_NAME: 'dummy-integration-secret',
	};
	offlineProcess = spawn(process.execPath, [
		offlineCli,
		'offline',
		'start',
		'--noAuth',
		'--localEnvironment',
		'--host',
		'127.0.0.1',
		'--lambdaPort',
		String(lambdaPort),
	], {
		cwd: buildDirectory,
		env: environment,
		stdio: ['ignore', 'ignore', 'ignore'],
	});

	const startDeadline = Date.now() + 20000;
	while (Date.now() < startDeadline) {
		if (offlineProcess.exitCode !== null) {
			throw new Error(`Local Lambda transport exited early (code ${offlineProcess.exitCode})`);
		}
		try {
			const response = await fetch(`http://127.0.0.1:${lambdaPort}/`, { signal: AbortSignal.timeout(1000) });
			if (response.status === 404) {
				addStage('local transport', 'passed', 'Serverless Offline invocation endpoint is listening on loopback');
				return;
			}
		} catch (error) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
	throw new Error('Local Lambda transport did not become ready within 20 seconds');
}

function makeEvent(penaltyId, receiptReference, penaltyType, isGroupPayment) {
	return {
		Records: [{
			eventSource: 'aws:sqs',
			messageAttributes: {
				PenaltyId: { stringValue: penaltyId },
				ReceiptReference: { stringValue: receiptReference },
				RegistrationNumber: { stringValue: 'DUMMY-REG' },
				PenaltyType: { stringValue: penaltyType },
				IsGroupPayment: { stringValue: String(isGroupPayment) },
			},
		}],
	};
}

async function invoke(event) {
	const response = await fetch(invocationUrl, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(event),
		signal: AbortSignal.timeout(15000),
	});
	const errorType = response.headers.get('x-amzn-errortype');
	const text = await response.text();
	if (!response.ok || errorType) {
		throw new Error(`Local Lambda invocation failed (${response.status}${errorType ? `, ${errorType}` : ''})`);
	}
	try {
		return text ? JSON.parse(text) : undefined;
	} catch (error) {
		throw new Error('Local Lambda returned a non-JSON result');
	}
}

function assertServiceCalls(expected) {
	const calls = state.requests
		.filter((request) => request.service !== 'secrets-manager')
		.map(({ service, method, path: requestPath }) => `${service} ${method} ${requestPath}`);
	assert.deepEqual(calls, expected);
}

function assertTimestampInRange(timestamp, start, end) {
	assert.equal(Number.isInteger(timestamp), true);
	assert.equal(timestamp >= start && timestamp <= end, true);
}

async function runScenario(name, action) {
	scenarioNumber += 1;
	const started = Date.now();
	log(`scenario ${scenarioNumber}/${scenarioNames.length} started: ${name}`);
	try {
		const evidence = await action();
		report.scenarios.push({
			name,
			status: 'passed',
			checks: evidence,
			durationMs: Date.now() - started,
		});
		log(`scenario ${scenarioNumber}/${scenarioNames.length} passed`);
	} catch (error) {
		hadFailure = true;
		report.scenarios.push({
			name,
			status: 'failed',
			reason: safeError(error),
			durationMs: Date.now() - started,
		});
		log(`scenario ${scenarioNumber}/${scenarioNames.length} failed: ${safeError(error)}`);
	}
}

async function runScenarios() {
	const existingId = 'DUMMY-FPN-EXISTING_FPN';
	const existingRecord = {
		PaymentCode: 'DUMMY-TOKEN-EXISTING',
		PenaltyStatus: 'PAID',
		PenaltyType: 'FPN',
		PenaltyReference: existingId,
		PaymentDetail: {
			PaymentMethod: 'CARD',
			PaymentRef: 'DUMMY-RECEIPT-EXISTING',
			AuthCode: 'DUMMY-AUTH-EXISTING',
			PaymentAmount: 50,
			PaymentDate: 1736899200,
		},
	};
	resetScenario();
	state.payments.set(existingId, existingRecord);
	await runScenario(scenarioNames[0], async () => {
		const result = await invoke(makeEvent(existingId, 'DUMMY-RECEIPT-EXISTING', 'FPN', false));
		assert.deepEqual(result, existingRecord);
		assertServiceCalls(['payments GET /payments/DUMMY-FPN-EXISTING_FPN']);
		return [
			'Invoked the SQS Lambda transport with a synthetic existing-payment event.',
			'Confirmed the stored payment was returned exactly; CPMS, documents, and create were not called.',
		];
	});

	const individualId = 'DUMMY-FPN-ORPHAN_FPN';
	const individualReceipt = 'DUMMY-RECEIPT-ORPHAN';
	const individualDocument = {
		ID: individualId,
		Value: {
			paymentToken: 'DUMMY-TOKEN-ORPHAN',
			referenceNo: individualId,
			penaltyAmount: 125,
		},
	};
	resetScenario();
	state.cpmsResponses.set(individualReceipt, { code: 801, auth_code: 'DUMMY-AUTH-ORPHAN' });
	state.documents.set(individualId, individualDocument);
	await runScenario(scenarioNames[1], async () => {
		const startedAt = Math.floor(Date.now() / 1000);
		const created = await invoke(makeEvent(individualId, individualReceipt, 'FPN', false));
		const finishedAt = Math.ceil(Date.now() / 1000);
		assert.equal(created.PaymentCode, 'DUMMY-TOKEN-ORPHAN');
		assert.equal(created.PenaltyStatus, 'PAID');
		assert.equal(created.PenaltyType, 'FPN');
		assert.equal(created.PenaltyReference, individualId);
		assert.equal(created.PaymentDetail.PaymentMethod, 'CARD');
		assert.equal(created.PaymentDetail.PaymentRef, individualReceipt);
		assert.equal(created.PaymentDetail.AuthCode, 'DUMMY-AUTH-ORPHAN');
		assert.equal(created.PaymentDetail.PaymentAmount, 125);
		assertTimestampInRange(created.PaymentDetail.PaymentDate, startedAt, finishedAt);

		const readBack = await invoke(makeEvent(individualId, individualReceipt, 'FPN', false));
		assert.deepEqual(readBack, created);
		assertServiceCalls([
			`payments GET /payments/${individualId}`,
			'cpms POST /confirm',
			`documents GET /documents/${individualId}`,
			'payments POST /payments',
			`payments GET /payments/${individualId}`,
		]);
		return [
			'Confirmed CPMS status, document lookup, payment creation, and exact independent replay read-back.',
			'Verified paid status, payment type, reference, amount, receipt, auth code, and generated timestamp.',
		];
	});

	const groupId = 'DUMMY-GROUP-001';
	const groupReceipt = 'DUMMY-RECEIPT-GROUP';
	const groupDocument = {
		ID: groupId,
		PaymentStatus: 'UNPAID',
		VehicleRegistration: 'DUMMY-REG',
		Location: 'DUMMY-LOCATION',
		Timestamp: 1736899200,
		TotalAmount: 200,
		Payments: [{
			PaymentCategory: 'FPN',
			TotalAmount: 75,
			PaymentStatus: 'UNPAID',
			Penalties: [
				{ ID: 'DUMMY-GROUP-FPN-001_FPN', Value: { penaltyType: 'fpn' } },
				{ ID: 'DUMMY-GROUP-FPN-002_FPN', Value: { penaltyType: 'fpn' } },
			],
		}],
	};
	resetScenario();
	state.cpmsResponses.set(groupReceipt, { code: 801, auth_code: 'DUMMY-AUTH-GROUP' });
	state.groupDocuments.set(groupId, groupDocument);
	await runScenario(scenarioNames[2], async () => {
		const startedAt = Math.floor(Date.now() / 1000);
		const created = await invoke(makeEvent(groupId, groupReceipt, 'FPN', true));
		const finishedAt = Math.ceil(Date.now() / 1000);
		assert.equal(created.PaymentCode, groupId);
		assert.equal(created.PenaltyType, 'FPN');
		assert.deepEqual(created.PenaltyIds, ['DUMMY-GROUP-FPN-001_FPN', 'DUMMY-GROUP-FPN-002_FPN']);
		assert.deepEqual(created.PaymentDetail, {
			PaymentMethod: 'CARD',
			AuthCode: 'DUMMY-AUTH-GROUP',
			PaymentAmount: 75,
			PaymentDate: created.PaymentDetail.PaymentDate,
		});
		assertTimestampInRange(created.PaymentDetail.PaymentDate, startedAt, finishedAt);

		const readBack = await invoke(makeEvent(groupId, groupReceipt, 'FPN', true));
		assert.deepEqual(readBack, created);
		assertServiceCalls([
			`payments GET /groupPayments/${groupId}`,
			'cpms POST /confirm',
			`documents GET /penaltyGroup/${groupId}`,
			'payments POST /groupPayments',
			`payments GET /groupPayments/${groupId}`,
		]);
		return [
			'Confirmed group document lookup, category-specific payment creation, and independent replay read-back.',
			'Verified group ID, category, member IDs, amount, auth code, and generated timestamp.',
			'Known-defect baseline: the current group payment record omits PaymentDetail.PaymentRef.',
		];
	});

	const cancelledId = 'DUMMY-FPN-CANCELLED_FPN';
	const cancelledReceipt = 'DUMMY-RECEIPT-CANCELLED';
	resetScenario();
	state.cpmsResponses.set(cancelledReceipt, { code: 807, auth_code: 'DUMMY-AUTH-CANCELLED' });
	await runScenario(scenarioNames[3], async () => {
		const result = await invoke(makeEvent(cancelledId, cancelledReceipt, 'FPN', false));
		assert.equal(result, `Payment cancelled with receipt reference ${cancelledReceipt}. Removing from SQS queue.`);
		assert.equal(state.payments.has(cancelledId), false);
		assertServiceCalls([
			`payments GET /payments/${cancelledId}`,
			'cpms POST /confirm',
		]);
		return [
			'Confirmed cancelled status is returned to the local Lambda invoker.',
			'Confirmed no document lookup or payment record was created.',
		];
	});
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		'\'': '&#39;',
	}[character]));
}

function countStatuses() {
	const statuses = ['passed', 'failed', 'skipped', 'not-run', 'dependency-unavailable'];
	return Object.fromEntries(statuses.map((status) => [
		status,
		report.scenarios.filter((scenario) => scenario.status === status).length,
	]));
}

function writeReports() {
	const counts = countStatuses();
	report.summary = {
		total: scenarioNames.length,
		...counts,
	};
	const jsonPath = path.join(reportDirectory, `${reportBasename}.json`);
	const htmlPath = path.join(reportDirectory, `${reportBasename}.html`);
	fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
	const scenarioRows = report.scenarios.map((scenario) => `
		<tr>
			<td>${escapeHtml(scenario.name)}</td>
			<td>${escapeHtml(scenario.status)}</td>
			<td>${escapeHtml((scenario.checks || []).join(' '))}${scenario.reason ? escapeHtml(scenario.reason) : ''}</td>
			<td>${escapeHtml(scenario.durationMs || 0)} ms</td>
		</tr>`).join('');
	const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Local integration test report</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#24292f}
h1,h2{line-height:1.2}table{width:100%;border-collapse:collapse;margin:1rem 0 2rem}
th,td{text-align:left;vertical-align:top;padding:.6rem;border:1px solid #d0d7de}
th{background:#f6f8fa}.meta{display:grid;grid-template-columns:max-content 1fr;gap:.35rem 1rem}
code{overflow-wrap:anywhere}.status{font-weight:700}
</style>
</head>
<body>
<h1>Local integration test report</h1>
<dl class="meta">
<dt>Timestamp</dt><dd>${escapeHtml(report.timestamp)}</dd>
<dt>Runtime</dt><dd>${escapeHtml(report.runtime)}</dd>
<dt>Target</dt><dd>${escapeHtml(report.target)}</dd>
<dt>Scenarios</dt><dd>${escapeHtml(counts.passed)} passed, ${escapeHtml(counts.failed)} failed, ${escapeHtml(counts.skipped)} skipped, ${escapeHtml(counts['not-run'])} not run, ${escapeHtml(counts['dependency-unavailable'])} dependency unavailable (of ${escapeHtml(scenarioNames.length)})</dd>
<dt>Safety gates</dt><dd>Synthetic fixtures only; loopback dependencies; no shared writes or real AWS credentials.</dd>
</dl>
<h2>Handler and transport inventory</h2>
<p>Export <code>handler</code>, local function <code>checkForOrphanedPayments</code>; SQS event interface with no HTTP business route. Invoked through the Serverless Offline Lambda transport.</p>
<h2>Scenarios</h2>
<table><thead><tr><th>Scenario</th><th>Status</th><th>Checks and evidence</th><th>Duration</th></tr></thead>
<tbody>${scenarioRows || '<tr><td colspan="4">No scenarios executed.</td></tr>'}</tbody></table>
<h2>Known-defect baseline</h2>
<ul>${report.knownDefects.map((defect) => `<li><strong>${escapeHtml(defect.label)}</strong>: ${escapeHtml(defect.details)} (${escapeHtml(defect.status)}).</li>`).join('')}</ul>
<h2>Setup</h2>
<pre>${escapeHtml(JSON.stringify(report.setup, null, 2))}</pre>
<h2>Cleanup</h2>
<pre>${escapeHtml(JSON.stringify(report.cleanup, null, 2))}</pre>
<h2>Limitations</h2>
<ul>${report.limitations.map((limitation) => `<li>${escapeHtml(limitation)}</li>`).join('')}</ul>
</body>
</html>\n`;
	fs.writeFileSync(htmlPath, html);
	return { jsonPath, htmlPath };
}

async function stopOffline() {
	if (!offlineProcess || offlineProcess.exitCode !== null) return;
	await new Promise((resolve) => {
		const timeout = setTimeout(() => {
			offlineProcess.kill('SIGKILL');
		}, 5000);
		offlineProcess.once('exit', () => {
			clearTimeout(timeout);
			resolve();
		});
		offlineProcess.kill('SIGTERM');
	});
}

async function closeMockServer() {
	if (!mockServer || !mockServer.listening) return;
	await new Promise((resolve, reject) => {
		mockServer.close((error) => (error ? reject(error) : resolve()));
	});
}

async function main() {
	fs.mkdirSync(reportDirectory, { recursive: true });
	try {
		lockFd = fs.openSync(lockPath, 'wx');
		fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid, startedAt: report.timestamp }));
		report.setup.status = 'in-progress';
		addStage('lock', 'passed', 'Exclusive integration run lock acquired');
		buildService();
		await startOffline();
		report.setup.status = 'passed';
		await runScenarios();
	} catch (error) {
		hadFailure = true;
		report.setup.status = 'failed';
		report.setup.failure = safeError(error);
		log(`setup failed: ${safeError(error)}`);
		for (const name of scenarioNames.slice(report.scenarios.length)) {
			report.scenarios.push({ name, status: 'not-run', reason: 'Setup did not complete' });
		}
	} finally {
		try {
			await stopOffline();
			report.cleanup.details.push('Task-owned Serverless Offline process stopped.');
			await closeMockServer();
			report.cleanup.details.push('Loopback mock service stopped.');
			report.cleanup.status = 'passed';
		} catch (error) {
			hadFailure = true;
			report.cleanup.status = 'failed';
			report.cleanup.details.push(safeError(error));
		}
		if (lockFd !== undefined) {
			try {
				fs.closeSync(lockFd);
				fs.unlinkSync(lockPath);
				report.cleanup.details.push('Exclusive run lock released.');
			} catch (error) {
				hadFailure = true;
				report.cleanup.status = 'failed';
				report.cleanup.details.push('Could not release the integration run lock.');
			}
		}
		const paths = writeReports();
		log(`cleanup: ${report.cleanup.status}`);
		log(`totals: ${JSON.stringify(report.summary)}`);
		log(`reports: ${path.relative(root, paths.htmlPath)} and ${path.relative(root, paths.jsonPath)}`);
	}
	if (hadFailure) process.exitCode = 1;
}

main();
