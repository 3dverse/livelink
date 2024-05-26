import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import ErrorPage from "./ErrorPage.tsx";
import "./index.css";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import SimpleCanvas from "./samples/simple-canvas/SimpleCanvas";
import DoubleCanvas from "./samples/double-canvas/DoubleCanvas";
import QuadrupleCanvas from "./samples/quadruple-canvas/QuadrupleCanvas";
import MultiSession from "./samples/multi-session/MultiSession";
import SmartObject from "./samples/smart-object/SmartObject.tsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      { path: "simple-canvas", element: <SimpleCanvas /> },
      { path: "double-canvas", element: <DoubleCanvas /> },
      { path: "quadruple-canvas", element: <QuadrupleCanvas /> },
      { path: "multi-session", element: <MultiSession /> },
      { path: "smart-object", element: <SmartObject /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />
);
