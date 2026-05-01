export const welcomeTemplate = (data: Record<string, any>) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to Travel Utility</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 0;
      background: #0e0e10;
      color: #ffffff;
    }
    header {
      background-color: #1f1f23;
      padding: 20px;
      text-align: center;
    }
    header h1 {
      margin: 0;
      font-size: 2.5em;
      color: #ff416c;
    }
    main {
      padding: 40px 20px;
      text-align: center;
    }
    main h2 {
      font-size: 2em;
      color: #ffffff;
    }
    main p {
      font-size: 1.1em;
      color: #cccccc;
      max-width: 600px;
      margin: 0 auto;
    }
    footer {
      background-color: #1f1f23;
      padding: 15px;
      text-align: center;
      font-size: 0.9em;
      color: #999;
    }
    .button {
      display: inline-block;
      margin-top: 25px;
      padding: 12px 25px;
      background-color: #ff416c;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
      transition: background 0.3s ease;
    }
    .button:hover {
      background-color: #ff5e84;
    }
  </style>
</head>
<body>

  <header>
    <h1>Travel Utility</h1>
  </header>

  <main>
    <h2>Welcome Aboard!</h2>
    <p>We're thrilled to have you here. At Travel Utility, we blend innovation and precision to launch your ideas into the stratosphere. Let’s make something amazing together.</p>
    <a href="${data.url}" class="button">Get Started</a>
  </main>

  <footer>
    &copy; 2025 Travel Utility. All rights reserved.
  </footer>

</body>
</html>
`;
};
