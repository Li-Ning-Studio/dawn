import { render } from 'preact';
import Stringing from './Stringing.tsx';

const preactRoot = document.getElementById('stringing-root');

const stringingCollectionId = preactRoot?.dataset['stringingCollectionId'] || null;
const isKnottingEnabled = preactRoot?.dataset['isKnottingEnabled'] || null;
const knottingCost = preactRoot?.dataset['knottingCost'] || null;
const stringingCost = preactRoot?.dataset['stringingCost'] || null;
const maxTension = preactRoot?.dataset['maxTension'] || null;

render(
  <Stringing
    stringingCollectionId={stringingCollectionId}
    maxTension={maxTension}
    isKnottingEnabled={isKnottingEnabled}
    knottingCost={knottingCost}
    stringingCost={stringingCost}
  />,
  preactRoot!,
);
