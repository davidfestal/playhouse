import { ApiProvider } from '@backstage/core-app-api';
import {
  MockAnalyticsApi,
  renderInTestApp,
  TestApiRegistry,
} from '@backstage/test-utils';
import { act, fireEvent } from '@testing-library/react';
import React from 'react';
import { EmbeddedScaffolderWorkflow } from './EmbeddedScaffolderWorkflow';
import {
  scaffolderApiRef,
  type ScaffolderApi,
} from '@backstage/plugin-scaffolder-react';
import { analyticsApiRef } from '@backstage/core-plugin-api';

const scaffolderApiMock: jest.Mocked<ScaffolderApi> = {
  scaffold: jest.fn(),
  getTemplateParameterSchema: jest.fn(),
  getIntegrationsList: jest.fn(),
  getTask: jest.fn(),
  streamLogs: jest.fn(),
  listActions: jest.fn(),
  listTasks: jest.fn(),
};

const analyticsMock = new MockAnalyticsApi();
const apis = TestApiRegistry.from(
  [scaffolderApiRef, scaffolderApiMock],
  [analyticsApiRef, analyticsMock],
);


describe('<EmbeddedScaffolderWorkflow />', () => {
  it('should embed workflow inside another component', async () => {
    const onComplete = jest.fn();
    const onError = jest.fn();
    scaffolderApiMock.scaffold.mockResolvedValue({ taskId: 'xyz' });

    scaffolderApiMock.getTemplateParameterSchema.mockResolvedValue({
      steps: [
        {
          title: 'Step 1',
          schema: {
            properties: {
              name: {
                type: 'string',
              },
            },
          },
        },
      ],
      title: 'React JSON Schema Form Test',
    });

    const { getByRole, getByText } = await renderInTestApp(
      <ApiProvider apis={apis}>
        <EmbeddedScaffolderWorkflow
          title="Different title than template"
          description={`
        ## This is markdown
        - overriding the template description
            `}
          onCreate={onComplete}
          onError={onError}
          namespace="default"
          templateName="docs-template"
          initialState={{
            name: 'prefilled-name',
          }}
          extensions={[]}
          frontPage={
            <>
              <h1>Front Page to workflow</h1>
              <p>
                Introduction page text.
              </p>
            </>
          }
          finishPage={
            <>
              <h1>Congratulations, this application is complete!</h1>
            </>
          }
          components={{
            ReviewStateComponent:() => (
              <h1>This is a different wrapper for the review page</h1>
            ),
            reviewButtonText: "Changed Review",
            createButtonText: "Changed Create",
          }
          }
        />
      </ApiProvider>,
    );

    // frontPage is rendered
    expect(getByRole('heading', { level: 1 }).innerHTML).toBe('Front Page to workflow');

    // move to workflow
    await act(async () => {
      fireEvent.click(getByRole('button'));
    });

    // Test template title is overriden
    expect(getByRole('heading', {level: 2}).innerHTML).toBe(
      'Different title than template',
    );

    expect(getByRole('textbox').innerHTML).toBeDefined();

    const input = getByRole('textbox') as HTMLInputElement;

    // The initial state of the form can be set
    expect(input.value).toBe('prefilled-name');

    const reviewButton = getByRole('button', {name: "Changed Review"}) as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(reviewButton);
    });

    const createButton = getByRole('button', {name: "Changed Create"}) as HTMLButtonElement;

    // Can supply a different Review wrapper
    expect(
      getByText('This is a different wrapper for the review page') as HTMLButtonElement,
    ).toBeDefined();

    await act(async () => {
      fireEvent.click(createButton);
    });

    // the final page is inserted after the workflow
    expect(
      getByText('Congratulations, this application is complete!'),
    ).toBeDefined();
  });
});

