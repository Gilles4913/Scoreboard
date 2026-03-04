import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminHome from "./AdminHome";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminHome />} />
      </Routes>
    </BrowserRouter>
  );
}
