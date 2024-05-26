import { useRouteError } from "react-router";
import { Link } from "react-router-dom";

function ErrorPage() {
  const error = useRouteError();
  console.error(error);

  return (
    <div id="error-page">
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p>
        <Link to="/">Back to home</Link>
      </p>
    </div>
  );
}

export default ErrorPage;
