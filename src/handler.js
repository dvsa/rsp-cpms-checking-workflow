import check from './functions/check';
import checkCpmsConfirm from './functions/checkCpmsConfirm';
import checkForOrphanedPayments from './functions/checkForOrphanedPayments';

const handler = {
	check,
	checkCpmsConfirm,
	checkForOrphanedPayments,
};

export default handler;
