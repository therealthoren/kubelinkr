import {
  Button,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  InputGroup,
  Intent,
  Popover,
} from '@blueprintjs/core';
import React, { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Select from 'react-select';
import { IPortForward, IProject } from '../../models/IConfig';
import { getIpcRequestData } from '../ipcHelper/ipcRequestData';
import { Channels } from '../../models/channel';

export interface EditPortForwardProps {
  isOpen: boolean;
  createMode?: boolean;
  onCancel: () => void;
  onDelete: (portForward: IPortForward, project: IProject) => void;
  onSaved: (portForward: IPortForward, project: IProject) => void;
  project: IProject;
  portForward: IPortForward | null;
}

const defaultProps = {
  createMode: false,
};

function AddOrEditPortForward({
  isOpen,
  onSaved,
  createMode,
  onDelete,
  portForward,
  project,
  onCancel,
}: EditPortForwardProps) {
  const [updatedPortForward, setUpdatedPortForward] =
    React.useState<IPortForward>(
      JSON.parse(
        JSON.stringify(
          createMode
            ? {
                id: uuidv4(),
                name: '',
              }
            : portForward,
        ),
      ),
    );
  const [loading, setLoading] = React.useState(false);
  const [changed, setChanged] = React.useState(false);
  const [deletePopOverOpen, setDeletePopOverOpen] = React.useState(false);
  const [updatedProject] = React.useState<IProject>(
    JSON.parse(JSON.stringify(project)),
  );
  const [popOverOpen, setPopOverOpen] = React.useState(false);
  const [namespaces, setNamespaces] = React.useState<string[]>([]);
  const [pods, setPods] = React.useState<string[]>([]);
  const [contexts, setContexts] = React.useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = React.useState<any>({});

  const setErrorForField = (field: string, message: string) => {
    const newErrors = { ...fieldErrors };
    newErrors[field] = message;
    setFieldErrors(newErrors);
  };

  const resetErrors = () => {
    setFieldErrors({});
  };

  const updatePortForwardProps = (key: string, value: any) => {
    resetErrors();
    // @ts-ignore
    updatedPortForward[key] = value;
    setUpdatedPortForward(updatedPortForward);
    setChanged(true);
    if (key === 'contextName') {
      setLoading(true);
      getIpcRequestData(Channels.REQUEST_GET_NAMESPACES, value)
        .then((data) => {
          setLoading(false);
          setNamespaces(data);
          return data;
        })
        .catch((e: any) => {
          setLoading(false);
          setErrorForField('contextName', `Could not load namespaces - ${e}`);
          /* empty */
        });
    } else if (key === 'contextNamespace') {
      setLoading(true);
      getIpcRequestData(Channels.REQUEST_GET_PODS, {
        context: updatedPortForward.contextName,
        namespace: value,
      })
        .then((data) => {
          setLoading(false);
          setPods(data);
          return data;
        })
        .catch((e: any) => {
          setLoading(false);
          setErrorForField('contextNamespace', `Could not load pods - ${e}`);
          /* empty */
        });
    }
  };

  const deletePortForward = () => {
    updatedProject.portforwards = updatedProject.portforwards.filter(
      (pf) => pf.id !== updatedPortForward.id,
    );
    onDelete(updatedPortForward, updatedProject);
  };

  const isFieldSet = (field: string) => {
    if (
      // @ts-ignore
      typeof updatedPortForward[field] !== 'undefined' &&
      // @ts-ignore
      updatedPortForward[field] != null
    ) {
      return true;
    }
    return false;
  };

  const saveProjectByPortForwarrd = () => {
    let found = false;
    // @ts-ignore
    updatedProject.portforwards = updatedProject.portforwards.map((pf) => {
      if (pf.id === updatedPortForward.id) {
        found = true;
        return updatedPortForward;
      }
      return pf;
    });
    if (!found) {
      updatedProject.portforwards.push(updatedPortForward);
    }
    onSaved(updatedPortForward, updatedProject);
  };

  useEffect(() => {
    setLoading(true);
    getIpcRequestData(Channels.REQUEST_GET_CONTEXTS)
      .then((data) => {
        setContexts(data);
        setLoading(false);
        return data;
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const isFinished = () => {
    return (
      updatedPortForward.contextName != null &&
      updatedPortForward.name != null &&
      updatedPortForward.name.length > 0 &&
      updatedPortForward.sourcePort > 0 &&
      updatedPortForward.localPort > 0
    );
  };

  return (
    <Dialog
      onClose={() => onCancel()}
      isCloseButtonShown={false}
      canEscapeKeyClose={false}
      style={{
        width: 'calc(100vw - 10px)',
        marginLeft: '10px',
        marginTop: '10px',
        marginBottom: '0px',
        height: 'calc(100vh - 40px)',
      }}
      title={
        createMode
          ? 'Add new Port Forward'
          : `Edit Port Forward ${project?.name}`
      }
      icon="info-sign"
      usePortal
      isOpen={isOpen}
    >
      <DialogBody>
        <FormGroup
          label="Select your Context"
          labelFor="text-input"
          labelInfo="(required)"
        >
          <Select
            isLoading={loading}
            isDisabled={loading}
            defaultValue={{
              value: updatedPortForward.contextName,
              label: updatedPortForward.contextName,
            }}
            onChange={(e) => updatePortForwardProps('contextName', e?.value)}
            options={contexts.map((n) => ({ value: n, label: n }))}
          />
          {fieldErrors.contextName && (
            <div style={{ color: 'red' }}>{fieldErrors.contextName}</div>
          )}
        </FormGroup>

        <FormGroup
          label="Select your Namespace"
          labelFor="text-input"
          labelInfo="(required)"
        >
          <Select
            isLoading={loading}
            isDisabled={loading || !isFieldSet('contextName')}
            value={{
              value: updatedPortForward.contextNamespace,
              label: updatedPortForward.contextNamespace,
            }}
            onChange={(e) =>
              updatePortForwardProps('contextNamespace', e?.value)
            }
            options={namespaces.map((n) => ({ value: n, label: n }))}
          />
          {fieldErrors.contextNamespace && (
            <div style={{ color: 'red' }}>{fieldErrors.contextNamespace}</div>
          )}
        </FormGroup>

        <FormGroup
          label="Select your Pod"
          labelFor="text-input"
          labelInfo="(required)"
        >
          <Select
            isLoading={loading}
            isDisabled={loading || !isFieldSet('name')}
            value={{
              value: updatedPortForward.name,
              label: updatedPortForward.name,
            }}
            onChange={(e) => updatePortForwardProps('name', e?.value)}
            options={pods.map((n) => ({ value: n, label: n }))}
          />
        </FormGroup>

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 10,
          }}
        >
          <FormGroup
            label="Your local port"
            labelFor="text-input"
            labelInfo="(required)"
          >
            <InputGroup
              id="text-input"
              type="number"
              placeholder="7999"
              onChange={(e) =>
                updatePortForwardProps(
                  'localPort',
                  parseInt(e.target.value, 10),
                )
              }
              value={updatedPortForward.localPort?.toString()}
            />
          </FormGroup>
          <FormGroup
            label="Kubernetes Intern Port"
            labelFor="text-input"
            labelInfo="(required)"
          >
            <InputGroup
              id="text-input"
              type="number"
              placeholder="80"
              onChange={(e) =>
                updatePortForwardProps(
                  'sourcePort',
                  parseInt(e.target.value, 10),
                )
              }
              value={updatedPortForward.sourcePort?.toString()}
            />
          </FormGroup>
        </div>
      </DialogBody>
      <DialogFooter
        actions={
          <Popover
            popoverClassName={Classes.POPOVER_CONTENT_SIZING}
            inheritDarkTheme={false}
            autoFocus
            enforceFocus={false}
            isOpen={popOverOpen}
            canEscapeKeyClose
            placement="left-start"
            usePortal={false}
            content={
              <div key="text">
                <p>
                  Are you sure you want to close? All your changes will be lost.
                </p>
                <Button
                  intent={Intent.DANGER}
                  className={Classes.POPOVER_DISMISS}
                  onClick={() => onCancel()}
                >
                  Yes
                </Button>
                <Button
                  onClick={() => setPopOverOpen(false)}
                  className={Classes.POPOVER_DISMISS}
                  style={{ marginRight: 10 }}
                >
                  No
                </Button>
              </div>
            }
            renderTarget={({ ...p }: any) => {
              return (
                <>
                  <Button
                    {...p}
                    disabled={!isFinished()}
                    onClick={() => saveProjectByPortForwarrd()}
                    intent="primary"
                    text={createMode ? 'Create' : 'Save'}
                  />
                  <Button
                    {...p}
                    onClick={() =>
                      changed ? setPopOverOpen(true) : onCancel()
                    }
                    intent="secondary"
                    text="Cancel"
                  />
                </>
              );
            }}
          />
        }
      >
        {createMode ? null : (
          <Popover
            popoverClassName={Classes.POPOVER_CONTENT_SIZING}
            inheritDarkTheme={false}
            canEscapeKeyClose
            autoFocus
            enforceFocus={false}
            isOpen={deletePopOverOpen}
            placement="left-start"
            usePortal={false}
            content={
              <div key="text">
                <p>
                  Are you sure you want to close? All your changes will be lost.
                </p>
                <Button
                  intent={Intent.DANGER}
                  className={Classes.POPOVER_DISMISS}
                  onClick={() => deletePortForward()}
                >
                  Yes
                </Button>
                <Button
                  onClick={() => setDeletePopOverOpen(false)}
                  className={Classes.POPOVER_DISMISS}
                  style={{ marginRight: 10 }}
                >
                  No
                </Button>
              </div>
            }
            renderTarget={({ ...p }: any) => {
              return (
                <Button
                  {...p}
                  onClick={() => setDeletePopOverOpen(true)}
                  intent="danger"
                  text="Delete"
                />
              );
            }}
          />
        )}
      </DialogFooter>
    </Dialog>
  );
}

AddOrEditPortForward.defaultProps = defaultProps;

export default AddOrEditPortForward;
