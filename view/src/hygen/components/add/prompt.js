const inputValidator = (input) => {
    if (input !== '') {
      return true
    }
}

module.exports = {
    prompt: ({ inquirer }) => {
      const questions = [
        {
          type: "select",
          name: "level",
          message: "Which Component category?",
          choices: ["common", "icons", "layout"],
        },
        {
          type: "input",
          name: "name",
          message: "What is the component name?",
        },
      ];
      return inquirer.prompt(questions).then((answers) => {
        const { level, name } = answers;
        return { level, name };
      });
    },
  };