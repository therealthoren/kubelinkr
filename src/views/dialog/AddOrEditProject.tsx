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
import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { IProject } from '../../models/IConfig';

export interface EditProjectProps {
  isOpen: boolean;
  createMode?: boolean;
  onCancel: () => void;
  onDelete: (project: IProject) => void;
  onSaved: (project: IProject) => void;
  project: IProject | null;
}

function AddOrEditProject({
  isOpen,
  onSaved,
  createMode,
  onDelete,
  project,
  onCancel,
}: EditProjectProps) {
  const [changed, setChanged] = React.useState(false);
  const [deletePopOverOpen, setDeletePopOverOpen] = React.useState(false);
  const [updatedProject, setUpdatedProject] = React.useState<IProject>(
    JSON.parse(
      JSON.stringify(
        createMode
          ? {
              id: uuidv4(),
              name: '',
              portforwards: [],
            }
          : project,
      ),
    ),
  );
  const [popOverOpen, setPopOverOpen] = React.useState(false);

  const updateProjectAttribute = (key: string, value: any) => {
    // @ts-ignore
    updatedProject[key] = value;
    setUpdatedProject(updatedProject);
    setChanged(true);
  };

  const isFinished = () => {
    return updatedProject.name === '';
  };

  return (
    <Dialog
      onClose={() => onCancel()}
      isCloseButtonShown={false}
      canEscapeKeyClose={false}
      style={{
        width: 'calc(100vw - 30px)',
        marginLeft: '10px',
        marginTop: '10px',
        marginBottom: '0px',
        height: 'calc(100vh - 30px)',
      }}
      title={createMode ? 'Add new project' : `Edit project ${project?.name}`}
      icon="info-sign"
      usePortal
      isOpen={isOpen}
    >
      <DialogBody>
        <FormGroup
          label="Enter your project name"
          labelFor="text-input"
          labelInfo="(required)"
        >
          <InputGroup
            onChange={(e) => {
              updateProjectAttribute('name', e.target.value);
            }}
            id="text-input"
            placeholder="kubernetes cloud name"
            defaultValue={updatedProject.name}
          />
        </FormGroup>
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
                    disabled={isFinished()}
                    onClick={() => onSaved(updatedProject)}
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
                  onClick={() => onDelete(updatedProject)}
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

export default AddOrEditProject;
