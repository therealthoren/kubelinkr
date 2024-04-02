import { Channels } from '../../models/channel';

const getIpcRequestData = (
  channel: Channels,
  requestData?: any,
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const answerId = Math.random().toString(36).substring(7);
    window.electron.ipcRenderer.sendMessage(channel, {
      data: requestData,
      answerId,
    });

    const timeout = setTimeout(() => {
      return reject(Error('Timeout'));
    }, 5000);

    window.electron.ipcRenderer.on(
      (Channels.REQUEST_ANSWER + answerId) as Channels,
      (data: any) => {
        clearTimeout(timeout);
        if (data.success) {
          return resolve(data.data);
        }
        return reject(data.error);
      },
    );
  });
};

// eslint-disable-next-line import/prefer-default-export
export { getIpcRequestData };
