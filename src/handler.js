import start from './functions/start';
import check from './functions/check';
import createPaymentRecord from './functions/createPaymentRecord';
import checkCpmsConfirm from './functions/checkCpmsConfirm';
import silentEnd from './functions/silentEnd';

const handler = {
	start,
	check,
	createPaymentRecord,
	checkCpmsConfirm,
	silentEnd,
};

export default handler;
